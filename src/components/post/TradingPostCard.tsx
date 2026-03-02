import { useState, useEffect, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Heart, MessageCircle, Share2, MoreVertical, Trash2, Pencil, Flag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CommentSection } from './CommentSection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'tai-khoan-game', label: 'Tài khoản Game', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  { value: 'pass-do', label: 'Pass đồ', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  { value: 'mua-sam', label: 'Mua sắm', color: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30' },
  { value: 'dich-vu', label: 'Dịch vụ', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  { value: 'crypto', label: 'Crypto', color: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30' },
  { value: 'mmo', label: 'MMO', color: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30' },
];

interface TradingPost {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  category: string | null;
  created_at: string;
  profiles?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface TradingPostCardProps {
  post: TradingPost;
  onDelete: () => void;
  onImageClick: (url: string | null) => void;
  onStartConversation: (userId: string) => void;
}

export const TradingPostCard = memo(({ post, onDelete, onImageClick, onStartConversation }: TradingPostCardProps) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentContent, setCurrentContent] = useState(post.content || '');

  const isOwner = user?.id === post.user_id;

  // Use transaction_posts table for likes - we'll use a simple like approach via localStorage for now
  // since transaction_posts doesn't have a dedicated likes table. We'll use the existing 'likes' table
  // with post_id pointing to transaction_post id
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
        await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
        setLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
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
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('transaction_posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', user?.id);
      if (error) throw error;
      toast({ title: 'Đã xóa bài viết' });
      onDelete();
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể xóa bài viết', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [post.id, user?.id, onDelete]);

  const handleEditPost = useCallback(async () => {
    if (!isOwner || !editContent.trim()) return;
    setIsEditing(true);
    try {
      const { error } = await supabase
        .from('transaction_posts')
        .update({ content: editContent.trim() })
        .eq('id', post.id);
      if (error) throw error;
      setCurrentContent(editContent.trim());
      toast({ title: 'Đã cập nhật bài viết' });
      setShowEditDialog(false);
      onDelete(); // refresh
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật bài viết', variant: 'destructive' });
    } finally {
      setIsEditing(false);
    }
  }, [isOwner, editContent, post.id, onDelete]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/trading`);
      toast({ title: 'Đã sao chép liên kết' });
    } catch {
      toast({ title: 'Lỗi', description: 'Không thể sao chép liên kết', variant: 'destructive' });
    }
  }, []);

  const catInfo = post.category
    ? CATEGORIES.find(c => c.value === post.category) || { label: post.category, color: 'bg-muted text-muted-foreground border-border' }
    : null;

  return (
    <>
      <Card className="glass">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Link to={`/profile/${post.user_id}`}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={post.profiles?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {(post.profiles?.display_name || post.profiles?.username || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/profile/${post.user_id}`}
                    className="font-semibold hover:underline max-w-[150px] truncate inline-block"
                  >
                    {post.profiles?.display_name || post.profiles?.username || 'Người dùng'}
                  </Link>
                  {catInfo && (
                    <Badge variant="outline" className={`rounded-lg text-[10px] px-1.5 py-0 ${catInfo.color} border`}>
                      {catInfo.label}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass">
                    {isOwner && (
                      <>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditContent(currentContent);
                            setShowEditDialog(true);
                          }}
                          className="cursor-pointer"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Chỉnh sửa bài viết
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setShowDeleteConfirm(true)}
                          className="text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Xóa bài viết
                        </DropdownMenuItem>
                      </>
                    )}
                    {!isOwner && (
                      <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer">
                        <Flag className="w-4 h-4 mr-2" />
                        Báo cáo bài viết
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {currentContent && (
                <p className="mt-2 text-sm whitespace-pre-wrap">{currentContent}</p>
              )}
              {post.image_url && (
                <img
                  src={post.image_url}
                  alt="Post"
                  className="mt-3 rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => onImageClick(post.image_url)}
                />
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="ghost" size="sm"
                  className={cn('rounded-xl gap-1.5 flex-1 h-8 text-xs', liked && 'text-destructive hover:text-destructive')}
                  onClick={handleLike}
                  disabled={isLiking || !user}
                >
                  <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
                  {likeCount > 0 && <span>{likeCount}</span>}
                  <span className="hidden sm:inline">Thích</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className={cn('rounded-xl gap-1.5 flex-1 h-8 text-xs', showComments && 'bg-secondary')}
                  onClick={() => setShowComments(!showComments)}
                >
                  <MessageCircle className="w-4 h-4" />
                  {commentCount > 0 && <span>{commentCount}</span>}
                  <span className="hidden sm:inline">Bình luận</span>
                </Button>
                <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 flex-1 h-8 text-xs" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Chia sẻ</span>
                </Button>
                {user?.id !== post.user_id && (
                  <Button
                    variant="ghost" size="sm"
                    className="rounded-xl gap-1.5 flex-1 h-8 text-xs"
                    onClick={() => onStartConversation(post.user_id)}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Nhắn tin</span>
                  </Button>
                )}
              </div>

              {/* Comments */}
              <CommentSection postId={post.id} isOpen={showComments} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa bài viết</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa bài viết này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Đang xóa...' : 'Xóa bài viết'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa bài viết</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Nội dung bài viết..."
            className="min-h-[120px] rounded-xl"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="rounded-xl">Hủy</Button>
            <Button onClick={handleEditPost} disabled={isEditing || !editContent.trim()} className="rounded-xl gradient-primary">
              {isEditing ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

TradingPostCard.displayName = 'TradingPostCard';
