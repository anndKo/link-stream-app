import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Heart, MessageCircle, Share2, MoreVertical, Trash2, Pencil, Flag, X, Image as ImageIcon, Send } from 'lucide-react';
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

const POST_MAX_WORDS = 800;
const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const TradingPostContent = memo(({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split('\n');
  const needsTruncation = lines.length > 3 && !expanded;
  const displayContent = needsTruncation ? lines.slice(0, 3).join('\n') : content;
  
  return (
    <div className="mt-2">
      <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
      {needsTruncation && (
        <button className="text-xs text-primary font-medium hover:underline mt-0.5" onClick={() => setExpanded(true)}>
          Xem thêm...
        </button>
      )}
      {expanded && lines.length > 3 && (
        <button className="text-xs text-primary font-medium hover:underline mt-0.5" onClick={() => setExpanded(false)}>
          Thu gọn
        </button>
      )}
    </div>
  );
});
TradingPostContent.displayName = 'TradingPostContent';

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
  onStartConversation: (userId: string, post?: TradingPost) => void;
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
  const [currentImageUrl, setCurrentImageUrl] = useState(post.image_url || null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editImageRemoved, setEditImageRemoved] = useState(false);
  const editImageInputRef = useRef<HTMLInputElement>(null);

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
    if (!isOwner || (!editContent.trim() && !editImagePreview)) return;
    setIsEditing(true);
    try {
      let newImageUrl = currentImageUrl;

      if (editImageFile) {
        const fileExt = editImageFile.name.split('.').pop();
        const fileName = `${user!.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('posts').upload(fileName, editImageFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
        newImageUrl = publicUrl;
      } else if (editImageRemoved) {
        newImageUrl = null;
      }

      const { error } = await supabase
        .from('transaction_posts')
        .update({ content: editContent.trim() || null, image_url: newImageUrl, updated_at: new Date().toISOString() })
        .eq('id', post.id);
      if (error) throw error;
      setCurrentContent(editContent.trim());
      setCurrentImageUrl(newImageUrl);
      setEditImageFile(null);
      setEditImageRemoved(false);
      toast({ title: 'Đã cập nhật bài viết' });
      setShowEditDialog(false);
      onDelete(); // refresh
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật bài viết', variant: 'destructive' });
    } finally {
      setIsEditing(false);
    }
  }, [isOwner, editContent, editImageFile, editImageRemoved, editImagePreview, currentImageUrl, post.id, user, onDelete]);

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
        <CardContent className="pt-4 px-3 sm:px-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <Link to={`/profile/${post.user_id}`} className="flex-shrink-0">
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                <AvatarImage src={post.profiles?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {(post.profiles?.display_name || post.profiles?.username || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0 overflow-hidden">
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
                  {(post as any).updated_at && (post as any).updated_at !== post.created_at && (
                    <span className="text-[10px] text-muted-foreground/70 italic">· Đã chỉnh sửa</span>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass z-[80]">
                    {isOwner && (
                      <>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditContent(currentContent);
                            setEditImagePreview(currentImageUrl);
                            setEditImageFile(null);
                            setEditImageRemoved(false);
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
              {currentContent && <TradingPostContent content={currentContent} />}
              {currentImageUrl && (
                <img
                  src={currentImageUrl}
                  alt="Post"
                  className="mt-3 rounded-lg max-h-80 w-full object-contain cursor-pointer hover:opacity-90 transition-opacity mx-auto"
                  onClick={() => onImageClick(currentImageUrl)}
                />
              )}

              {/* Message button - above action bar */}
              {user?.id !== post.user_id && (
                <Button
                  variant="outline" size="sm"
                  className="rounded-xl gap-1.5 w-full h-8 text-xs mt-3"
                  onClick={() => onStartConversation(post.user_id, post)}
                >
                  <Send className="w-3.5 h-3.5" />
                  Nhắn tin
                </Button>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="ghost" size="sm"
                  className={cn('rounded-xl gap-1 flex-1 h-8 text-xs px-1', liked && 'text-destructive hover:text-destructive')}
                  onClick={handleLike}
                  disabled={isLiking || !user}
                >
                  <Heart className={cn('w-3.5 h-3.5', liked && 'fill-current')} />
                  <span className="truncate">{likeCount > 0 ? likeCount + ' ' : ''}Thích</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className={cn('rounded-xl gap-1 flex-1 h-8 text-xs px-1', showComments && 'bg-secondary')}
                  onClick={() => setShowComments(!showComments)}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="truncate">{commentCount > 0 ? commentCount + ' ' : ''}Bình luận</span>
                </Button>
                <Button variant="ghost" size="sm" className="rounded-xl gap-1 flex-1 h-8 text-xs px-1" onClick={handleShare}>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="truncate">Chia sẻ</span>
                </Button>
              </div>

            </div>
          </div>
          {/* Comments - outside the avatar flex so it takes full width */}
          <CommentSection postId={post.id} isOpen={showComments} />
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
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => {
                if (countWords(e.target.value) <= POST_MAX_WORDS) {
                  setEditContent(e.target.value);
                }
              }}
              placeholder="Nội dung bài viết..."
              className="min-h-[120px] rounded-xl"
            />
            <p className={cn('text-xs text-right', countWords(editContent) > POST_MAX_WORDS ? 'text-destructive' : 'text-muted-foreground')}>
              {countWords(editContent)}/{POST_MAX_WORDS}
            </p>
            {/* Image edit section */}
            {editImagePreview ? (
              <div className="relative inline-block">
                <img src={editImagePreview} alt="Preview" className="max-h-48 rounded-xl object-cover" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 rounded-full"
                  onClick={() => {
                    setEditImageFile(null);
                    setEditImagePreview(null);
                    setEditImageRemoved(true);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2"
                onClick={() => editImageInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4" />
                Thêm ảnh
              </Button>
            )}
            <input
              ref={editImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 5 * 1024 * 1024) {
                    toast({ title: 'Lỗi', description: 'Ảnh không được vượt quá 5MB', variant: 'destructive' });
                    return;
                  }
                  setEditImageFile(file);
                  const reader = new FileReader();
                  reader.onload = () => setEditImagePreview(reader.result as string);
                  reader.readAsDataURL(file);
                  setEditImageRemoved(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="rounded-xl">Hủy</Button>
            <Button onClick={handleEditPost} disabled={isEditing || (!editContent.trim() && !editImagePreview)} className="rounded-xl gradient-primary">
              {isEditing ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

TradingPostCard.displayName = 'TradingPostCard';
