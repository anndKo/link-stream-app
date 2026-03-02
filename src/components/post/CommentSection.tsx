import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Send, Trash2, Reply, CornerDownRight, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const REACTION_EMOJIS = [
  { emoji: '👍', label: 'Like', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  { emoji: '❤️', label: 'Love', bg: 'bg-pink-100 dark:bg-pink-900/40' },
  { emoji: '😂', label: 'Haha', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  { emoji: '😮', label: 'Wow', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  { emoji: '😢', label: 'Sad', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
  { emoji: '😡', label: 'Angry', bg: 'bg-red-100 dark:bg-red-900/40' },
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

  const activeEmoji = userReaction ? REACTION_EMOJIS.find(e => e.emoji === userReaction.emoji) : null;

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
          {REACTION_EMOJIS.map(({ emoji, label, bg }) => (
            <button
              key={emoji}
              className={cn(
                'text-lg hover:scale-150 transition-all duration-200 p-1 rounded-full',
                userReaction?.emoji === emoji && `${bg} scale-125`
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

// Render @mention - click scrolls to that user's comment
const CommentContent = memo(({ content, comments, onMentionClick }: { 
  content: string; 
  comments: Comment[];
  onMentionClick: (userId: string) => void;
}) => {
  const mentionRegex = /(@\S+)/g;
  const parts = content.split(mentionRegex);

  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const name = part.slice(1);
          const mentioned = comments.find(
            c => c.profile?.display_name === name || c.profile?.username === name
          );
          if (mentioned) {
            return (
              <button
                key={i}
                className="text-primary font-medium hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onMentionClick(mentioned.user_id);
                }}
              >
                {part}
              </button>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
});
CommentContent.displayName = 'CommentContent';

export const CommentSection = memo(({ postId, isOpen }: CommentSectionProps) => {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string; parentId: string | null } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to a user's most recent comment
  const scrollToUserComment = useCallback((userId: string) => {
    // Find newest reply first, then newest top-level
    const userComments = comments
      .filter(c => c.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Prefer replies, then top-level
    const replies = userComments.filter(c => c.parent_id);
    const target = replies[0] || userComments[0];
    if (!target) return;

    // Expand parent if it's a reply
    if (target.parent_id) {
      const topLevelIds = new Set(comments.filter(c => !c.parent_id).map(c => c.id));
      let rootId = target.parent_id;
      if (!topLevelIds.has(rootId)) {
        const parent = comments.find(c => c.id === rootId);
        if (parent?.parent_id && topLevelIds.has(parent.parent_id)) {
          rootId = parent.parent_id;
        }
      }
      setExpandedReplies(prev => new Set(prev).add(rootId));
    }

    // Wait for DOM update then scroll
    setTimeout(() => {
      const el = document.getElementById(`comment-${target.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedCommentId(target.id);
        setTimeout(() => setHighlightedCommentId(null), 2000);
      }
    }, 100);
  }, [comments]);

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

  const organizedComments = useMemo(() => {
    const topLevel = comments.filter(c => !c.parent_id);
    const replies = comments.filter(c => c.parent_id);
    const topLevelIds = new Set(topLevel.map(c => c.id));
    const replyMap = new Map<string, Comment[]>();

    replies.forEach(r => {
      let rootId = r.parent_id!;
      if (!topLevelIds.has(rootId)) {
        const parentComment = comments.find(c => c.id === rootId);
        if (parentComment?.parent_id && topLevelIds.has(parentComment.parent_id)) {
          rootId = parentComment.parent_id;
        }
      }
      if (!replyMap.has(rootId)) replyMap.set(rootId, []);
      replyMap.get(rootId)!.push(r);
    });

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
    
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: Comment = {
      id: tempId,
      content,
      created_at: new Date().toISOString(),
      user_id: user.id,
      parent_id: replyingTo ? (replyingTo.parentId || replyingTo.id) : null,
      profile: undefined,
      reactions: [],
    };

    const cachedProfile = comments.find(c => c.user_id === user.id)?.profile;
    if (cachedProfile) {
      optimisticComment.profile = cachedProfile;
    }

    setComments(prev => [optimisticComment, ...prev]);
    setNewComment('');
    const savedReplyingTo = replyingTo;
    setReplyingTo(null);

    if (savedReplyingTo) {
      const rootId = savedReplyingTo.parentId || savedReplyingTo.id;
      setExpandedReplies(prev => new Set(prev).add(rootId));
    }

    try {
      const insertData: any = { post_id: postId, user_id: user.id, content };
      if (savedReplyingTo) {
        insertData.parent_id = savedReplyingTo.parentId || savedReplyingTo.id;
      }
      const { data, error } = await supabase.from('comments').insert(insertData).select('*').single();
      if (error) throw error;

      if (data) {
        if (!cachedProfile) {
          const { data: profileData } = await supabase
            .from('public_profiles')
            .select('id, display_name, avatar_url, username')
            .eq('id', user.id)
            .single();
          if (profileData) {
            optimisticComment.profile = profileData as any;
          }
        }
        setComments(prev => prev.map(c => c.id === tempId ? { ...c, ...data, parent_id: data.parent_id || null, profile: optimisticComment.profile, reactions: [] } : c));
      }
      toast({ title: 'Đã thêm bình luận' });
    } catch (error) {
      setComments(prev => prev.filter(c => c.id !== tempId));
      toast({ title: 'Lỗi', description: 'Không thể thêm bình luận', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, newComment, postId, isSubmitting, replyingTo, comments]);

  const handleDelete = useCallback(async (commentId: string) => {
    const deleted = comments.find(c => c.id === commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;
      toast({ title: 'Đã xóa bình luận' });
    } catch (error) {
      if (deleted) setComments(prev => [...prev, deleted]);
      toast({ title: 'Lỗi', description: 'Không thể xóa bình luận', variant: 'destructive' });
    }
  }, [comments]);

  const handleReaction = useCallback(async (commentId: string, emoji: string) => {
    if (!user) return;

    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      const existing = c.reactions?.find(r => r.user_id === user.id);
      let newReactions = [...(c.reactions || [])];
      if (existing) {
        if (existing.emoji === emoji) {
          newReactions = newReactions.filter(r => r.id !== existing.id);
        } else {
          newReactions = newReactions.map(r => r.id === existing.id ? { ...r, emoji } : r);
        }
      } else {
        newReactions.push({ id: `temp-${Date.now()}`, comment_id: commentId, user_id: user.id, emoji });
      }
      return { ...c, reactions: newReactions };
    }));

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
      fetchComments();
    }
  }, [user, fetchComments]);

  const handleReply = useCallback((comment: Comment, isReply = false) => {
    const username = comment.profile?.display_name || comment.profile?.username || 'Người dùng';
    setReplyingTo({
      id: comment.id,
      username,
      parentId: isReply ? comment.parent_id : null,
    });
    setNewComment(`@${username} `);
    inputRef.current?.focus();
  }, []);

  const getTopReply = useCallback((replies: Comment[]) => {
    if (replies.length === 0) return null;
    return replies.reduce((best, r) => {
      const bestCount = best.reactions?.length || 0;
      const rCount = r.reactions?.length || 0;
      return rCount > bestCount ? r : best;
    }, replies[0]);
  }, []);

  const renderReactionSummary = useCallback((comment: Comment) => {
    const totalReactions = comment.reactions?.length || 0;
    if (totalReactions === 0) return null;

    const reactionGroups = new Map<string, number>();
    (comment.reactions || []).forEach(r => {
      reactionGroups.set(r.emoji, (reactionGroups.get(r.emoji) || 0) + 1);
    });

    return (
      <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
        {[...reactionGroups.entries()].slice(0, 3).map(([emoji]) => (
          <span key={emoji} className="text-xs">{emoji}</span>
        ))}
        <span className="text-xs text-muted-foreground ml-0.5">{totalReactions}</span>
      </div>
    );
  }, []);

  const renderComment = useCallback((comment: Comment, isReply = false) => {
    const displayName = comment.profile?.display_name || comment.profile?.username || 'Người dùng';
    const isHighlighted = highlightedCommentId === comment.id;
    const userReaction = comment.reactions?.find(r => r.user_id === user?.id);

    return (
      <div
        key={comment.id}
        id={`comment-${comment.id}`}
        className={cn(
          'flex gap-2 group relative transition-colors duration-500',
          isReply && 'ml-6 sm:ml-10',
          isHighlighted && 'bg-primary/10 rounded-xl'
        )}
      >
        {isReply && <CornerDownRight className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-3" />}
        <Link to={`/profile/${comment.user_id}`} className="flex-shrink-0">
          <Avatar className={isReply ? 'h-7 w-7' : 'h-8 w-8'}>
            <AvatarImage src={comment.profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="bg-secondary/50 rounded-2xl px-3 py-2">
            <div className="flex items-center gap-2">
              <Link to={`/profile/${comment.user_id}`} className="font-semibold text-sm hover:underline">
                {displayName}
              </Link>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: vi })}
              </span>
            </div>
            <CommentContent content={comment.content} comments={comments} onMentionClick={scrollToUserComment} />
          </div>
          {/* Single row: Like + Reply left, Reaction summary right */}
          <div className="flex items-center justify-between mt-0.5 px-2">
            <div className="flex items-center gap-3">
              {user && (
                <ReactionButton
                  userReaction={userReaction}
                  commentId={comment.id}
                  onReaction={handleReaction}
                />
              )}
              {user && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground font-medium"
                  onClick={() => handleReply(comment, isReply)}
                >
                  Trả lời
                </button>
              )}
            </div>
            {renderReactionSummary(comment)}
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
  }, [user, isAdmin, renderReactionSummary, handleReply, handleDelete, handleReaction, comments, highlightedCommentId, scrollToUserComment]);

  if (!isOpen) return null;

  return (
    <div className="border-t border-border/50 pt-4 mt-4 space-y-3 animate-fade-in">
      <div ref={commentsContainerRef} className="space-y-3 max-h-96 overflow-y-auto">
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
