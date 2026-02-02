import { useState, useEffect, useCallback, memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Send, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
}

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

  const fetchComments = useCallback(async () => {
    if (!isOpen) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for comments
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, display_name, avatar_url, username')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const commentsWithProfiles = (data || []).map(comment => ({
          ...comment,
          profile: profileMap.get(comment.user_id)
        }));
        setComments(commentsWithProfiles);
      } else {
        setComments(data || []);
      }
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, isOpen, fetchComments]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      toast({ title: 'Đã thêm bình luận' });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể thêm bình luận',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, newComment, postId, isSubmitting]);

  const handleDelete = useCallback(async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      toast({ title: 'Đã xóa bình luận' });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa bình luận',
        variant: 'destructive',
      });
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="border-t border-border/50 pt-4 mt-4 space-y-4 animate-fade-in">
      {/* Comment form */}
      {user && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Viết bình luận..."
            className="flex-1 rounded-xl"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newComment.trim() || isSubmitting}
            className="rounded-xl"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      )}

      {/* Comments list */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">
            Đang tải bình luận...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Chưa có bình luận nào
          </div>
        ) : (
          comments.map((comment) => (
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
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 px-1">
                  {formatDistanceToNow(new Date(comment.created_at), {
                    addSuffix: true,
                    locale: vi,
                  })}
                </p>
              </div>
              {(user?.id === comment.user_id || isAdmin) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={() => handleDelete(comment.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
});

CommentSection.displayName = 'CommentSection';
