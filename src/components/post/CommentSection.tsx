import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Send, Trash2, Filter, SmilePlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

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
  profile?: {
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
  reactions?: CommentReaction[];
}

type SortType = 'newest' | 'popular';

interface CommentSectionProps {
  postId: string;
  isOpen: boolean;
}

export const CommentSection = memo(({ postId, isOpen }: CommentSectionProps) => {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortType, setSortType] = useState<SortType>('newest');

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

      // Fetch profiles and reactions in parallel
      const [profilesRes, reactionsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from('public_profiles').select('id, display_name, avatar_url, username').in('id', userIds)
          : Promise.resolve({ data: [] }),
        commentIds.length > 0
          ? supabase.from('comment_reactions').select('*').in('comment_id', commentIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map<string, { display_name: string; avatar_url: string | null; username: string }>(
        (profilesRes.data || []).map(p => [p.id, p] as [string, { display_name: string; avatar_url: string | null; username: string }])
      );
      const reactionsMap = new Map<string, CommentReaction[]>();
      ((reactionsRes.data || []) as CommentReaction[]).forEach((r) => {
        if (!reactionsMap.has(r.comment_id)) reactionsMap.set(r.comment_id, []);
        reactionsMap.get(r.comment_id)!.push(r);
      });

      const commentsWithData: Comment[] = (data || []).map(comment => ({
        ...comment,
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId, isOpen, fetchComments]);

  const sortedComments = useMemo(() => {
    if (sortType === 'popular') {
      return [...comments].sort((a, b) => (b.reactions?.length || 0) - (a.reactions?.length || 0));
    }
    return comments; // already sorted newest first
  }, [comments, sortType]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({ post_id: postId, user_id: user.id, content: newComment.trim() });
      if (error) throw error;
      setNewComment('');
      toast({ title: 'Đã thêm bình luận' });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: 'Lỗi', description: 'Không thể thêm bình luận', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, newComment, postId, isSubmitting]);

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
      // Check existing reaction
      const { data: existing } = await supabase
        .from('comment_reactions')
        .select('id, emoji')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        if (existing.emoji === emoji) {
          // Remove reaction
          await supabase.from('comment_reactions').delete().eq('id', existing.id);
        } else {
          // Update emoji
          await supabase.from('comment_reactions').update({ emoji }).eq('id', existing.id);
        }
      } else {
        // Add new reaction
        await supabase.from('comment_reactions').insert({ comment_id: commentId, user_id: user.id, emoji });
      }
      fetchComments();
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  }, [user, fetchComments]);

  if (!isOpen) return null;

  return (
    <div className="border-t border-border/50 pt-4 mt-4 space-y-4 animate-fade-in">
      {/* Filter + Comment form */}
      <div className="flex items-center justify-between gap-2">
        {user && (
          <form onSubmit={handleSubmit} className="flex gap-2 flex-1">
            <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Viết bình luận..." className="flex-1 rounded-xl" />
            <Button type="submit" size="icon" disabled={!newComment.trim() || isSubmitting} className="rounded-xl">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 flex-shrink-0">
              <Filter className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass">
            <DropdownMenuItem onClick={() => setSortType('newest')} className={sortType === 'newest' ? 'bg-secondary' : ''}>
              Mới nhất
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortType('popular')} className={sortType === 'popular' ? 'bg-secondary' : ''}>
              Nổi bật nhất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Comments list */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Đang tải bình luận...</div>
        ) : sortedComments.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">Chưa có bình luận nào</div>
        ) : (
          sortedComments.map((comment) => {
            // Group reactions by emoji
            const reactionGroups = new Map<string, string[]>();
            (comment.reactions || []).forEach(r => {
              if (!reactionGroups.has(r.emoji)) reactionGroups.set(r.emoji, []);
              reactionGroups.get(r.emoji)!.push(r.user_id);
            });
            const userReaction = comment.reactions?.find(r => r.user_id === user?.id);

            return (
              <div key={comment.id} className="flex gap-3 group">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.profile?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {(comment.profile?.display_name || comment.profile?.username)?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="bg-secondary/50 rounded-xl px-3 py-2">
                    <p className="font-medium text-sm">
                      {comment.profile?.display_name || comment.profile?.username || 'Người dùng'}
                    </p>
                    <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: vi })}
                    </p>
                    {/* Reaction button */}
                    {user && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                            <SmilePlus className="w-3 h-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1 flex gap-1" side="top" align="start">
                          {REACTION_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              className={`text-lg hover:scale-125 transition-transform p-1 rounded ${userReaction?.emoji === emoji ? 'bg-primary/20' : ''}`}
                              onClick={() => handleReaction(comment.id, emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    )}
                    {/* Display reactions */}
                    {[...reactionGroups.entries()].map(([emoji, users]) => (
                      <button
                        key={emoji}
                        className={`text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border transition-colors ${
                          users.includes(user?.id || '') ? 'bg-primary/15 border-primary/30' : 'bg-secondary/50 border-border/50'
                        }`}
                        onClick={() => user && handleReaction(comment.id, emoji)}
                      >
                        <span>{emoji}</span>
                        <span className="text-muted-foreground">{users.length}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {(user?.id === comment.user_id || isAdmin) && (
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(comment.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

CommentSection.displayName = 'CommentSection';
