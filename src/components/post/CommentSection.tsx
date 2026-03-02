import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Send, Trash2, ThumbsUp, Heart, Laugh, Frown, Angry, SmilePlus, Reply, CornerDownRight, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const REACTION_EMOJIS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
];

interface CommentReaction {
  id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profile?: {
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
  reactions?: CommentReaction[];
  replies?: Comment[];
}

interface CommentSectionProps {
  postId: string;
  isOpen: boolean;
}

const ReactionButton = memo(({ userReaction, commentId, onReaction }: {
  userReaction?: CommentReaction;
  commentId: string;
  onReaction: (commentId: string, emoji: string) => void;
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setShowPicker(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hideTimeout.current = setTimeout(() => setShowPicker(false), 2000);
  }, []);

  const handleSelect = useCallback((emoji: string) => {
    onReaction(commentId, emoji);
    setShowPicker(false);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
  }, [commentId, onReaction]);

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className={cn(
          'text-xs font-medium transition-colors',
          userReaction ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onReaction(commentId, userReaction?.emoji || '👍')}
      >
        {userReaction ? userReaction.emoji : 'Thích'}
      </button>
      {showPicker && (
        <div className="absolute bottom-full left-0 mb-1 flex items-center gap-0.5 bg-popover border border-border rounded-full px-1.5 py-1 shadow-lg z-10 animate-fade-in">
          {REACTION_EMOJIS.map(({ emoji, label }) => (
            <button
              key={emoji}
              className={cn(
                'text-lg hover:scale-150 transition-all duration-200 p-0.5 rounded-full',
                userReaction?.emoji === emoji && 'bg-primary/20'
              )}
              onClick={(e) => { e.stopPropagation(); handleSelect(emoji); }}
              title={label}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
ReactionButton.displayName = 'ReactionButton';

export const CommentSection = memo(({ postId, isOpen }: CommentSectionProps) => {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string; parentId: string | null } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [showReactionUsers, setShowReactionUsers] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchComments = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const commentIds = (data || []).map(c => c.id);
      const userIds = [...new Set((data || []).map(c => c.user_id))];

      const [profilesRes, reactionsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from('public_profiles').select('id, display_name, avatar_url, username').in('id', userIds)
          : Promise.resolve({ data: [] }),
        commentIds.length > 0
          ? supabase.from('comment_reactions').select('*').in('comment_id', commentIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map(
        (profilesRes.data || []).map(p => [p.id, p] as [string, { display_name: string; avatar_url: string | null; username: string }])
      );
      const reactionsMap = new Map<string, CommentReaction[]>();
      ((reactionsRes.data || []) as CommentReaction[]).forEach((r) => {
        if (!reactionsMap.has(r.comment_id)) reactionsMap.set(r.comment_id, []);
        reactionsMap.get(r.comment_id)!.push(r);
      });

      const commentsWithData: Comment[] = (data || []).map(comment => ({
        ...comment,
        parent_id: comment.parent_id || null,
        profile: profileMap.get(comment.user_id) || undefined,
        reactions: reactionsMap.get(comment.id) || [],
      }));
      setComments(commentsWithData);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [postId, isOpen]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    if (!isOpen) return;
    const channel = supabase
      .channel(`comments-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, () => fetchComments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_reactions' }, () => fetchComments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId, isOpen, fetchComments]);

  // Organize comments into tree - level 2 max visual depth
  const organizedComments = useMemo(() => {
    const topLevel = comments.filter(c => !c.parent_id);
    const replies = comments.filter(c => c.parent_id);
    
    // Build reply map - all replies go under their root parent
    const replyMap = new Map<string, Comment[]>();
    const topLevelIds = new Set(topLevel.map(c => c.id));
    
    replies.forEach(r => {
      // Find root parent (level 1)
      let rootId = r.parent_id!;
      if (!topLevelIds.has(rootId)) {
        // This is a reply to a reply - find its root parent
        const parentComment = comments.find(c => c.id === rootId);
        if (parentComment?.parent_id && topLevelIds.has(parentComment.parent_id)) {
          rootId = parentComment.parent_id;
        }
      }
      if (!replyMap.has(rootId)) replyMap.set(rootId, []);
      replyMap.get(rootId)!.push(r);
    });

    // Sort replies oldest first
    replyMap.forEach(arr => arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

    return topLevel.map(c => ({
      ...c,
      replies: replyMap.get(c.id) || [],
    }));
  }, [comments]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const content = newComment.trim();
    try {
      const insertData: any = { post_id: postId, user_id: user.id, content };
      if (replyingTo) {
        insertData.parent_id = replyingTo.parentId || replyingTo.id;
      }
      const { data, error } = await supabase.from('comments').insert(insertData).select('*').single();
      if (error) throw error;
      // Optimistic update - add comment immediately
      if (data) {
        const newCommentObj: Comment = {
          ...data,
          parent_id: data.parent_id || null,
          profile: undefined, // will be filled on next fetch
          reactions: [],
        };
        // Fetch profile for the new comment
        const { data: profileData } = await supabase
          .from('public_profiles')
          .select('id, display_name, avatar_url, username')
          .eq('id', user.id)
          .single();
        if (profileData) {
          newCommentObj.profile = profileData as any;
        }
        setComments(prev => [newCommentObj, ...prev]);
      }
      setNewComment('');
      setReplyingTo(null);
      toast({ title: 'Đã thêm bình luận' });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: 'Lỗi', description: 'Không thể thêm bình luận', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, newComment, postId, isSubmitting, replyingTo]);

  const handleDelete = useCallback(async (commentId: string) => {
    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;
      toast({ title: 'Đã xóa bình luận' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể xóa bình luận', variant: 'destructive' });
    }
  }, []);

  const handleReaction = useCallback(async (commentId: string, emoji: string) => {
    if (!user) return;
    try {
      const { data: existing } = await supabase
        .from('comment_reactions')
        .select('id, emoji')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        if (existing.emoji === emoji) {
          await supabase.from('comment_reactions').delete().eq('id', existing.id);
        } else {
          await supabase.from('comment_reactions').update({ emoji }).eq('id', existing.id);
        }
      } else {
        await supabase.from('comment_reactions').insert({ comment_id: commentId, user_id: user.id, emoji });
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  }, [user]);

  const handleReply = useCallback((comment: Comment, isReply = false) => {
    const username = comment.profile?.display_name || comment.profile?.username || 'Người dùng';
    setReplyingTo({
      id: comment.id,
      username,
      parentId: isReply ? comment.parent_id : null, // if replying to a reply, use parent's parent
    });
    setNewComment(`@${username} `);
    inputRef.current?.focus();
  }, []);

  const getTopReply = useCallback((replies: Comment[]) => {
    if (replies.length === 0) return null;
    // Return the reply with most reactions
    return replies.reduce((best, r) => {
      const bestCount = best.reactions?.length || 0;
      const rCount = r.reactions?.length || 0;
      return rCount > bestCount ? r : best;
    }, replies[0]);
  }, []);

  const renderReactions = useCallback((comment: Comment) => {
    const reactionGroups = new Map<string, string[]>();
    (comment.reactions || []).forEach(r => {
      if (!reactionGroups.has(r.emoji)) reactionGroups.set(r.emoji, []);
      reactionGroups.get(r.emoji)!.push(r.user_id);
    });
    const userReaction = comment.reactions?.find(r => r.user_id === user?.id);
    const totalReactions = comment.reactions?.length || 0;

    // Get top emoji (most used)
    let topEmoji = '👍';
    let maxCount = 0;
    reactionGroups.forEach((users, emoji) => {
      if (users.length > maxCount) {
        maxCount = users.length;
        topEmoji = emoji;
      }
    });

    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Like/React button with hover */}
        {user && (
          <ReactionButton
            userReaction={userReaction}
            commentId={comment.id}
            onReaction={handleReaction}
          />
        )}
        {/* Show top reaction with count */}
        {totalReactions > 0 && (
          <button
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowReactionUsers(showReactionUsers === comment.id ? null : comment.id)}
          >
            {[...reactionGroups.keys()].slice(0, 3).map(emoji => (
              <span key={emoji} className="text-sm">{emoji}</span>
            ))}
            <span className="ml-0.5">{totalReactions}</span>
          </button>
        )}
        {/* Reaction users list */}
        {showReactionUsers === comment.id && totalReactions > 0 && (
          <div className="absolute z-20 mt-1 bg-popover border border-border rounded-xl p-2 shadow-lg min-w-[150px] animate-fade-in">
            {(comment.reactions || []).map(r => {
              const rProfile = comments.find(c => c.user_id === r.user_id)?.profile;
              return (
                <div key={r.id} className="flex items-center gap-2 py-1 text-xs">
                  <span>{r.emoji}</span>
                  <span className="text-foreground">{rProfile?.display_name || rProfile?.username || 'Người dùng'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [user, handleReaction, showReactionUsers, comments]);

  const renderComment = useCallback((comment: Comment, isReply = false) => {
    return (
      <div key={comment.id} className={cn('flex gap-2 group relative', isReply && 'ml-6 sm:ml-10')}>
        {isReply && <CornerDownRight className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-3" />}
        <Avatar className={isReply ? 'h-7 w-7 flex-shrink-0' : 'h-8 w-8 flex-shrink-0'}>
          <AvatarImage src={comment.profile?.avatar_url || ''} />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {(comment.profile?.display_name || comment.profile?.username)?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="bg-secondary/50 rounded-2xl px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">
                {comment.profile?.display_name || comment.profile?.username || 'Người dùng'}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: vi })}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-0.5 px-2">
            {renderReactions(comment)}
            {/* Reply button */}
            {user && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground font-medium"
                onClick={() => handleReply(comment, isReply)}
              >
                Trả lời
              </button>
            )}
          </div>
        </div>
        {(user?.id === comment.user_id || isAdmin) && (
          <Button
            variant="ghost" size="icon"
            className="h-6 w-6 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive flex-shrink-0"
            onClick={() => handleDelete(comment.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }, [user, isAdmin, renderReactions, handleReply, handleDelete]);

  if (!isOpen) return null;

  return (
    <div className="border-t border-border/50 pt-4 mt-4 space-y-3 animate-fade-in">
      {/* Comments list */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4 text-sm">Đang tải bình luận...</div>
        ) : organizedComments.length === 0 ? (
          <div className="text-center text-muted-foreground py-4 text-sm">Chưa có bình luận nào</div>
        ) : (
          organizedComments.map((comment) => {
            const topReply = getTopReply(comment.replies || []);
            const isExpanded = expandedReplies.has(comment.id);
            const replyCount = (comment.replies || []).length;

            return (
              <div key={comment.id} className="space-y-1">
                {renderComment(comment)}
                {/* Show top reply or all replies */}
                {replyCount > 0 && (
                  <div className="space-y-1">
                    {isExpanded ? (
                      <>
                        {(comment.replies || []).map(reply => renderComment(reply, true))}
                        <button
                          className="ml-10 sm:ml-14 text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                          onClick={() => setExpandedReplies(prev => { const n = new Set(prev); n.delete(comment.id); return n; })}
                        >
                          <ChevronUp className="w-3 h-3" />
                          Thu gọn
                        </button>
                      </>
                    ) : (
                      <>
                        {topReply && renderComment(topReply, true)}
                        {replyCount > 1 && (
                          <button
                            className="ml-10 sm:ml-14 text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                            onClick={() => setExpandedReplies(prev => new Set(prev).add(comment.id))}
                          >
                            <ChevronDown className="w-3 h-3" />
                            Xem thêm bình luận ({replyCount - 1})
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Comment input - sticky on mobile */}
      {user && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm pt-2 pb-1 -mx-1 px-1">
          {replyingTo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-t-xl mb-0">
              <Reply className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Trả lời <strong>{replyingTo.username}</strong></span>
              <button
                type="button"
                className="ml-auto text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={() => { setReplyingTo(null); setNewComment(''); }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyingTo ? `Trả lời ${replyingTo.username}...` : 'Viết bình luận...'}
              className="flex-1 rounded-xl h-9 text-sm"
            />
            <Button type="submit" size="icon" disabled={!newComment.trim() || isSubmitting} className="rounded-xl h-9 w-9 flex-shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
});

CommentSection.displayName = 'CommentSection';
