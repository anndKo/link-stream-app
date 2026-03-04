// @ts-nocheck
import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2, Globe, Lock, Flag, X, Pencil, Eye, EyeOff, Users, Image } from 'lucide-react';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CommentSection } from './CommentSection';
import { Post } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ImageGrid, parseImageUrls } from '@/components/post/ImageGrid';
import { ImageLightbox } from '@/components/ui/image-lightbox';

const POST_MAX_WORDS = 800;
const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const PostContent = memo(({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split('\n');
  const needsTruncation = lines.length > 3 && !expanded;
  const displayContent = needsTruncation ? lines.slice(0, 3).join('\n') : content;
  
  return (
    <div className="mb-4">
      <p className="text-foreground whitespace-pre-wrap leading-relaxed">{displayContent}</p>
      {needsTruncation && (
        <button className="text-sm text-primary font-medium hover:underline mt-1" onClick={() => setExpanded(true)}>
          Xem thêm...
        </button>
      )}
      {expanded && lines.length > 3 && (
        <button className="text-sm text-primary font-medium hover:underline mt-1" onClick={() => setExpanded(false)}>
          Thu gọn
        </button>
      )}
    </div>
  );
});
PostContent.displayName = 'PostContent';

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
  const [showComments, setShowComments] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  
  // New states for edit & delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false);
  const [editVisibility, setEditVisibility] = useState<string>('public');
  const [currentVisibility, setCurrentVisibility] = useState<string>((post as any).visibility || 'public');
  const [currentContent, setCurrentContent] = useState(post.content || '');
  const [currentImageUrl, setCurrentImageUrl] = useState(post.image_url || null);
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [editImageRemoved, setEditImageRemoved] = useState(false);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (fullscreenOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [fullscreenOpen]);

  const isOwner = user?.id === post.user_id;
  const canDelete = isOwner || isAdmin;

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
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      toast({ title: 'Đã xóa bài viết', description: 'Bài viết đã được xóa thành công.' });
      onDelete?.();
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể xóa bài viết. Vui lòng thử lại.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [canDelete, post.id, onDelete]);

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
        // Combine existing kept images with new uploads
        const keptImages = editImagePreviews.filter(p => p.startsWith('http') && !p.startsWith('blob:'));
        const allUrls = [...keptImages, ...urls];
        newImageUrl = allUrls.length === 1 ? allUrls[0] : (allUrls.length > 0 ? JSON.stringify(allUrls) : null);
      } else if (editImageRemoved) {
        const keptImages = editImagePreviews.filter(p => p.startsWith('http') && !p.startsWith('blob:'));
        newImageUrl = keptImages.length === 1 ? keptImages[0] : (keptImages.length > 0 ? JSON.stringify(keptImages) : null);
      }

      const { error } = await supabase.from('posts').update({ 
        content: editContent.trim() || null, 
        image_url: newImageUrl,
        updated_at: new Date().toISOString() 
      }).eq('id', post.id);
      if (error) throw error;
      setCurrentContent(editContent.trim());
      setCurrentImageUrl(newImageUrl);
      setEditImageFiles([]);
      setEditImageRemoved(false);
      toast({ title: 'Đã cập nhật bài viết' });
      setShowEditDialog(false);
      onDelete?.(); // refresh
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật bài viết.', variant: 'destructive' });
    } finally {
      setIsEditing(false);
    }
  }, [isOwner, editContent, editImageFiles, editImageRemoved, editImagePreviews, currentImageUrl, post.id, user, onDelete]);

  const handleEditVisibility = useCallback(async () => {
    if (!isOwner) return;
    try {
      const { error } = await supabase.from('posts').update({ visibility: editVisibility }).eq('id', post.id);
      if (error) throw error;
      setCurrentVisibility(editVisibility);
      toast({ title: 'Đã cập nhật quyền xem' });
      setShowVisibilityDialog(false);
      onDelete?.(); // refresh
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật quyền xem.', variant: 'destructive' });
    }
  }, [isOwner, editVisibility, post.id, onDelete]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${post.user_id}`);
      toast({ title: 'Đã sao chép liên kết', description: 'Liên kết bài viết đã được sao chép vào clipboard.' });
    } catch {
      toast({ title: 'Lỗi', description: 'Không thể sao chép liên kết.', variant: 'destructive' });
    }
  }, [post.user_id]);

  const handleReport = useCallback(async () => {
    if (!user || !reportReason) return;
    try {
      const { error } = await supabase.from('post_reports').insert({
        reporter_id: user.id, post_id: post.id, post_type: 'post',
        reason: reportReason, description: reportDescription || null,
      });
      if (error) throw error;
      toast({ title: 'Đã gửi báo cáo', description: 'Báo cáo sẽ được gửi đến quản trị viên xem xét.' });
      setShowReportDialog(false);
      setReportReason('');
      setReportDescription('');
    } catch (error) {
      console.error('Error reporting post:', error);
      toast({ title: 'Lỗi', description: 'Không thể gửi báo cáo.', variant: 'destructive' });
    }
  }, [user, post.id, reportReason, reportDescription]);

  const profile = post.profiles;
  const isPrivate = currentVisibility === 'private';
  const isFriends = currentVisibility === 'friends';
  const displayName = profile?.display_name || profile?.username || 'Người dùng';

  const actionsBar = (
    <div className="flex items-center gap-1 sm:gap-2 pt-3 border-t border-border/50">
      <Button
        variant="ghost" size="sm"
        className={cn('rounded-xl gap-1.5 flex-1 px-2 sm:px-3', liked && 'text-destructive hover:text-destructive')}
        onClick={handleLike}
        disabled={isLiking || !user}
      >
        <Heart className={cn('w-4 h-4 sm:w-5 sm:h-5', liked && 'fill-current')} />
        <span className="text-xs sm:text-sm">{likeCount} <span className="hidden sm:inline">Thích</span></span>
      </Button>
      <Button
        variant="ghost" size="sm"
        className={cn('rounded-xl gap-1.5 flex-1 px-2 sm:px-3', showComments && 'bg-secondary')}
        onClick={() => setShowComments(!showComments)}
      >
        <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-xs sm:text-sm">{commentCount} <span className="hidden sm:inline">Bình luận</span></span>
      </Button>
      <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 flex-1 px-2 sm:px-3" onClick={handleShare}>
        <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-xs sm:text-sm hidden sm:inline">Chia sẻ</span>
      </Button>
    </div>
  );

  return (
    <>
      <article className="glass rounded-2xl p-5 hover-lift animate-fade-in">
        <div className="flex items-start justify-between mb-4">
          <Link to={`/profile/${post.user_id}`} className="flex items-center gap-3 group min-w-0">
            <Avatar className="h-12 w-12 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all flex-shrink-0">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="font-semibold group-hover:text-primary transition-colors truncate max-w-[200px]" title={displayName}>
                {displayName.length > 20 ? (
                  <span className="inline-block overflow-hidden whitespace-nowrap">
                    <span className="inline-block animate-marquee">{displayName}</span>
                  </span>
                ) : displayName}
              </h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}
                {(post as any).updated_at && (post as any).updated_at !== post.created_at && (
                  <span className="text-xs text-muted-foreground/70 italic ml-1">· Đã chỉnh sửa</span>
                )}
                {isPrivate ? <Lock className="w-3 h-3 ml-1" /> : isFriends ? <Users className="w-3 h-3 ml-1" /> : <Globe className="w-3 h-3 ml-1" />}
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
              {isOwner && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      setEditVisibility(currentVisibility);
                      setShowVisibilityDialog(true);
                    }}
                    className="cursor-pointer"
                  >
                    {isPrivate ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                    Chỉnh sửa quyền xem
                  </DropdownMenuItem>
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
                </>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Xóa bài viết
                </DropdownMenuItem>
              )}
              {user && user.id !== post.user_id && (
                <>
                  {canDelete && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => setShowReportDialog(true)} className="text-warning cursor-pointer">
                    <Flag className="w-4 h-4 mr-2" />
                    Báo cáo bài viết
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        {currentContent && <PostContent content={currentContent} />}

        {/* Edited label inline with time */}
        {currentImageUrl && (
          <div className="mb-4">
            <ImageGrid 
              images={parseImageUrls(currentImageUrl)} 
              onImageClick={(url) => setLightboxSrc(url)}
            />
          </div>
        )}

        {actionsBar}
        <CommentSection postId={post.id} isOpen={showComments} />
      </article>

      {/* Fullscreen Post View */}
      {fullscreenOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col animate-fade-in" style={{ overflow: 'hidden' }}>
          <div className="flex justify-end p-4 sticky top-0 z-10 flex-shrink-0">
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-secondary/80" onClick={() => setFullscreenOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 max-w-3xl mx-auto w-full px-4 pb-6 space-y-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{displayName}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}
                </p>
              </div>
            </div>
            {currentContent && <p className="text-foreground whitespace-pre-wrap leading-relaxed text-lg">{currentContent}</p>}
            {currentImageUrl && (
              <div className="space-y-2">
                {parseImageUrls(currentImageUrl).map((url, i) => (
                  <img key={i} src={url} alt="Post image" className="w-full h-auto rounded-xl" loading="lazy" />
                ))}
              </div>
            )}
            {actionsBar}
            <CommentSection postId={post.id} isOpen={true} />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
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

      {/* Edit Post Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="glass max-w-md">
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
                <Image className="w-4 h-4" />
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


      {/* Edit Visibility Dialog */}
      <Dialog open={showVisibilityDialog} onOpenChange={setShowVisibilityDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa quyền xem</DialogTitle>
            <DialogDescription>Chọn ai có thể xem bài viết này</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={editVisibility} onValueChange={setEditVisibility}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Công khai
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Riêng tư
                  </div>
                </SelectItem>
                <SelectItem value="friends">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Bạn bè
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVisibilityDialog(false)} className="rounded-xl">Hủy</Button>
            <Button onClick={handleEditVisibility} className="rounded-xl gradient-primary">Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Báo cáo bài viết</DialogTitle>
            <DialogDescription>Báo cáo sẽ được gửi đến quản trị viên để xem xét</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lý do báo cáo</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Chọn lý do" /></SelectTrigger>
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
              <Textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} placeholder="Mô tả chi tiết vấn đề..." className="rounded-xl" />
            </div>
            <Button onClick={handleReport} disabled={!reportReason} className="w-full rounded-xl gradient-primary">Gửi báo cáo</Button>
          </div>
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

PostCard.displayName = 'PostCard';
