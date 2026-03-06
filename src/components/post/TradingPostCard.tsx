// @ts-nocheck
import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Heart, MessageCircle, Share2, MoreVertical, Trash2, Pencil, Flag, X, Image as ImageIcon, Send, Plus } from 'lucide-react';
import { ImageLightbox } from '@/components/ui/image-lightbox';
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
import { ImageGrid, parseImageUrls } from '@/components/post/ImageGrid';

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
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [editImageRemoved, setEditImageRemoved] = useState(false);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
    if (!isOwner || (!editContent.trim() && editImagePreviews.length === 0)) return;
    setIsEditing(true);
    try {
      let newImageUrl = currentImageUrl;

      if (editImageFiles.length > 0) {
        const urls: string[] = [];
        for (const file of editImageFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('posts').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
          urls.push(publicUrl);
        }
        const keptImages = editImagePreviews.filter(p => p.startsWith('http') && !p.startsWith('blob:'));
        const allUrls = [...keptImages, ...urls];
        newImageUrl = allUrls.length === 1 ? allUrls[0] : (allUrls.length > 0 ? JSON.stringify(allUrls) : null);
      } else if (editImageRemoved) {
        const keptImages = editImagePreviews.filter(p => p.startsWith('http') && !p.startsWith('blob:'));
        newImageUrl = keptImages.length === 1 ? keptImages[0] : (keptImages.length > 0 ? JSON.stringify(keptImages) : null);
      }

      const { error } = await supabase
        .from('transaction_posts')
        .update({ content: editContent.trim() || null, image_url: newImageUrl, updated_at: new Date().toISOString() })
        .eq('id', post.id);
      if (error) throw error;
      setCurrentContent(editContent.trim());
      setCurrentImageUrl(newImageUrl);
      setEditImageFiles([]);
      setEditImageRemoved(false);
      toast({ title: 'Đã cập nhật bài viết' });
      setShowEditDialog(false);
      onDelete(); // refresh
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật bài viết', variant: 'destructive' });
    } finally {
      setIsEditing(false);
    }
  }, [isOwner, editContent, editImageFiles, editImageRemoved, editImagePreviews, currentImageUrl, post.id, user, onDelete]);

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
    <Card className="glass overflow-hidden">
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
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  {dropdownOpen && <div className="fixed inset-0 bg-black/50 z-[79]" onClick={() => setDropdownOpen(false)} />}
                  <DropdownMenuContent align="end" className="glass z-[80]">
                    {isOwner && (
                      <>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditContent(currentContent);
                            setEditImagePreviews(parseImageUrls(currentImageUrl));
                            setEditImageFiles([]);
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
                <div className="mt-3 -mx-1 sm:mx-0">
                  <ImageGrid 
                    images={parseImageUrls(currentImageUrl)} 
                    onImageClick={(url) => setLightboxSrc(url)}
                    wideMobile
                  />
                </div>
              )}

              {/* Message button - above action bar */}
              {user?.id !== post.user_id && (
                <Button
                  variant="outline" size="sm"
                  className="rounded-xl gap-1.5 w-full h-9 text-xs mt-3"
                  onClick={() => onStartConversation(post.user_id, post)}
                >
                  <Send className="w-3.5 h-3.5" />
                  Nhắn tin
                </Button>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between gap-1 mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="ghost" size="sm"
                  className={cn('rounded-xl gap-1.5 flex-1 h-9 text-xs', liked && 'text-destructive hover:text-destructive')}
                  onClick={handleLike}
                  disabled={isLiking || !user}
                >
                  <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
                  <span className="truncate">{likeCount > 0 ? likeCount + ' ' : ''}Thích</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className={cn('rounded-xl gap-1.5 flex-1 h-9 text-xs', showComments && 'bg-secondary')}
                  onClick={() => setShowComments(!showComments)}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="truncate">{commentCount > 0 ? commentCount + ' ' : ''}Bình luận</span>
                </Button>
                <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 flex-1 h-9 text-xs" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
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
        <AlertDialogContent className="glass z-[110]">
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
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!lightboxSrc) setShowEditDialog(open); }} modal={!lightboxSrc}>
        <DialogContent className="glass max-w-md z-[110]" onInteractOutside={(e) => { if (lightboxSrc) e.preventDefault(); }} onPointerDownOutside={(e) => { if (lightboxSrc) e.preventDefault(); }} onFocusOutside={(e) => { if (lightboxSrc) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa bài viết</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={editContent}
              onChange={(e) => {
                if (countWords(e.target.value) <= POST_MAX_WORDS) {
                  setEditContent(e.target.value);
                }
              }}
              placeholder="Nội dung bài viết..."
              className="min-h-[100px] rounded-xl text-sm"
            />
            {editImagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 p-2 bg-secondary/30 rounded-xl">
                {editImagePreviews.map((preview, i) => (
                  <div key={i} className="relative aspect-square">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setLightboxSrc(preview)}
                    />
                    <button
                      className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-80 hover:opacity-100 z-10"
                      onClick={() => {
                        setEditImagePreviews(prev => prev.filter((_, idx) => idx !== i));
                        setEditImageRemoved(true);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg gap-1.5 h-8 text-xs"
                onClick={() => editImageInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4" />
                Thêm ảnh
              </Button>
              <p className={cn('text-xs', countWords(editContent) > POST_MAX_WORDS ? 'text-destructive' : 'text-muted-foreground')}>
                {countWords(editContent)}/{POST_MAX_WORDS}
              </p>
            </div>
            <input
              ref={editImageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                const validFiles = files.filter(f => {
                  if (f.size > 5 * 1024 * 1024) {
                    toast({ title: 'Lỗi', description: `${f.name} vượt quá 5MB`, variant: 'destructive' });
                    return false;
                  }
                  return true;
                });
                setEditImageFiles(prev => [...prev, ...validFiles]);
                setEditImagePreviews(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);
                setEditImageRemoved(false);
                if (editImageInputRef.current) editImageInputRef.current.value = '';
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)} className="rounded-xl">Hủy</Button>
            <Button size="sm" onClick={handleEditPost} disabled={isEditing || (!editContent.trim() && editImagePreviews.length === 0)} className="rounded-xl gradient-primary">
              {isEditing ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImageLightbox
        src={lightboxSrc || ''}
        isOpen={!!lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />
    </>
  );
});

TradingPostCard.displayName = 'TradingPostCard';
