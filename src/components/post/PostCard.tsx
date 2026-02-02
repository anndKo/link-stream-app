import { useState, useEffect, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2, Globe, Lock, Flag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { CommentSection } from './CommentSection';
import { Post } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
}

export const PostCard = memo(({ post, onDelete }: PostCardProps) => {
  const { user, isAdmin } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  const canDelete = user?.id === post.user_id || isAdmin;

  const fetchLikeStatus = useCallback(async () => {
    if (!post.id) return;

    try {
      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      setLikeCount(count || 0);

      if (user) {
        const { data } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .maybeSingle();

        setLiked(!!data);
      }
    } catch (error) {
      console.error('Error fetching like status:', error);
    }
  }, [post.id, user]);

  const fetchCommentCount = useCallback(async () => {
    if (!post.id) return;

    try {
      const { count } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      setCommentCount(count || 0);
    } catch (error) {
      console.error('Error fetching comment count:', error);
    }
  }, [post.id]);

  useEffect(() => {
    fetchLikeStatus();
    fetchCommentCount();
  }, [fetchLikeStatus, fetchCommentCount]);

  const handleLike = useCallback(async () => {
    if (!user || isLiking) return;

    setIsLiking(true);
    try {
      if (liked) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        setLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('likes')
          .insert({
            post_id: post.id,
            user_id: user.id,
          });

        setLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLiking(false);
    }
  }, [user, isLiking, liked, post.id]);

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;

      toast({
        title: 'Đã xóa bài viết',
        description: 'Bài viết đã được xóa thành công.',
      });

      onDelete?.();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa bài viết. Vui lòng thử lại.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [canDelete, post.id, onDelete]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${post.user_id}`);
      toast({
        title: 'Đã sao chép liên kết',
        description: 'Liên kết bài viết đã được sao chép vào clipboard.',
      });
    } catch {
      toast({
        title: 'Lỗi',
        description: 'Không thể sao chép liên kết.',
        variant: 'destructive',
      });
    }
  }, [post.user_id]);

  const handleReport = useCallback(async () => {
    if (!user || !reportReason) return;

    try {
      const { error } = await supabase.from('post_reports').insert({
        reporter_id: user.id,
        post_id: post.id,
        post_type: 'post',
        reason: reportReason,
        description: reportDescription || null,
      });

      if (error) throw error;

      toast({
        title: 'Đã gửi báo cáo',
        description: 'Báo cáo sẽ được gửi đến quản trị viên xem xét.',
      });
      setShowReportDialog(false);
      setReportReason('');
      setReportDescription('');
    } catch (error) {
      console.error('Error reporting post:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi báo cáo.',
        variant: 'destructive',
      });
    }
  }, [user, post.id, reportReason, reportDescription]);

  const profile = post.profiles;
  const isPrivate = (post as any).visibility === 'private';

  return (
    <article className="glass rounded-2xl p-5 hover-lift animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <Link to={`/profile/${post.user_id}`} className="flex items-center gap-3 group">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {(profile?.display_name || profile?.username)?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold group-hover:text-primary transition-colors">
              {profile?.display_name || profile?.username || 'Người dùng'}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              @{profile?.username || 'unknown'} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}
              {isPrivate ? (
                <Lock className="w-3 h-3 ml-1" />
              ) : (
                <Globe className="w-3 h-3 ml-1" />
              )}
            </p>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass">
            {canDelete && (
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'Đang xóa...' : 'Xóa bài viết'}
              </DropdownMenuItem>
            )}
            {user && user.id !== post.user_id && (
              <>
                {canDelete && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={() => setShowReportDialog(true)}
                  className="text-warning cursor-pointer"
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Báo cáo bài viết
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      {post.content && (
        <p className="text-foreground mb-4 whitespace-pre-wrap leading-relaxed">
          {post.content}
        </p>
      )}

      {/* Image */}
      {post.image_url && (
        <>
          <div 
            className="mb-4 rounded-xl overflow-hidden cursor-pointer"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={post.image_url}
              alt="Post image"
              className="w-full h-auto max-h-[500px] object-cover hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </div>
          <ImageLightbox
            src={post.image_url}
            alt="Post image"
            isOpen={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
          />
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'rounded-xl gap-2 flex-1',
            liked && 'text-destructive hover:text-destructive'
          )}
          onClick={handleLike}
          disabled={isLiking || !user}
        >
          <Heart className={cn('w-5 h-5', liked && 'fill-current')} />
          <span>{likeCount} Thích</span>
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            'rounded-xl gap-2 flex-1',
            showComments && 'bg-secondary'
          )}
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle className="w-5 h-5" />
          <span>{commentCount} Bình luận</span>
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-xl gap-2 flex-1"
          onClick={handleShare}
        >
          <Share2 className="w-5 h-5" />
          <span>Chia sẻ</span>
        </Button>
      </div>

      {/* Comments Section */}
      <CommentSection postId={post.id} isOpen={showComments} />

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Báo cáo bài viết</DialogTitle>
            <DialogDescription>
              Báo cáo sẽ được gửi đến quản trị viên để xem xét
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lý do báo cáo</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Chọn lý do" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="inappropriate">Nội dung không phù hợp</SelectItem>
                  <SelectItem value="violence">Bạo lực</SelectItem>
                  <SelectItem value="fake">Thông tin sai lệch</SelectItem>
                  <SelectItem value="harassment">Quấy rối</SelectItem>
                  <SelectItem value="other">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mô tả chi tiết (tùy chọn)</Label>
              <Textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Mô tả chi tiết vấn đề..."
                className="rounded-xl"
              />
            </div>
            <Button
              onClick={handleReport}
              disabled={!reportReason}
              className="w-full rounded-xl gradient-primary"
            >
              Gửi báo cáo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
});

PostCard.displayName = 'PostCard';
