import { useState, useRef, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { Image, X, Send, Globe, Lock, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const POST_MAX_WORDS = 800;
const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';

interface CreatePostProps {
  onPostCreated?: () => void;
}

export const CreatePost = memo(({ onPostCreated }: CreatePostProps) => {
  const { user, profile } = useAuth();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private' | 'friends'>('public');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Lỗi',
          description: 'Ảnh không được vượt quá 5MB',
          variant: 'destructive'
        });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const removeImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setContent((prev) => prev + emoji);
    }
  }, [content]);

  const handleSubmit = useCallback(async () => {
    if (!user || !content.trim() && !imageFile) return;

    setIsSubmitting(true);
    try {
      let imageUrl = null;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.
        from('posts').
        upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.
        from('posts').
        getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const { error } = await supabase.
      from('posts').
      insert({
        user_id: user.id,
        content: content.trim() || null,
        image_url: imageUrl,
        visibility: visibility
      });

      if (error) throw error;

      setContent('');
      removeImage();
      setVisibility('public');

      toast({
        title: 'Đăng bài thành công!',
        description: visibility === 'public' ? 'Bài viết của bạn đã được đăng công khai.' : visibility === 'friends' ? 'Bài viết chỉ bạn bè mới xem được.' : 'Bài viết riêng tư đã được lưu.'
      });

      onPostCreated?.();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể đăng bài. Vui lòng thử lại.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, content, imageFile, visibility, removeImage, onPostCreated]);

  return (
    <div className="glass rounded-2xl p-5 animate-fade-in">
      <div className="flex gap-4">
        <Link to={`/profile/${user?.id}`} className="flex-shrink-0">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                if (countWords(e.target.value) <= POST_MAX_WORDS) {
                  setContent(e.target.value);
                }
              }}
              placeholder="Bạn đang nghĩ gì?"
              className="min-h-[100px] resize-none border-0 bg-secondary/50 rounded-xl focus-visible:ring-primary" />
            <p className={cn('text-xs text-right', countWords(content) > POST_MAX_WORDS ? 'text-destructive' : 'text-muted-foreground')}>
              {countWords(content)}/{POST_MAX_WORDS}
            </p>
          </div>


          {imagePreview &&
          <div className="relative inline-block">
              <img
              src={imagePreview}
              alt="Preview"
              className="max-h-64 rounded-xl object-cover" />

              <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full"
              onClick={removeImage}>

                <X className="w-4 h-4" />
              </Button>
            </div>
          }

          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden" />

              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl gap-1 sm:gap-2 text-primary hover:text-primary h-8 px-2 sm:px-3"
                onClick={() => fileInputRef.current?.click()}>
                <Image className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm">Ảnh</span>
              </Button>
              
              <EmojiPickerPopover onEmojiSelect={handleEmojiSelect} />

              <Select value={visibility} onValueChange={(v: 'public' | 'private' | 'friends') => setVisibility(v)}>
                <SelectTrigger className="w-auto gap-1 sm:gap-2 rounded-xl border-0 bg-secondary/50 h-8 px-2 sm:px-3 text-xs sm:text-sm">
                  {visibility === 'public' ? (
                    <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  ) : visibility === 'friends' ? (
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-warning" />
                  )}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Công khai
                    </div>
                  </SelectItem>
                  <SelectItem value="friends">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Bạn bè
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Riêng tư
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim() && !imageFile}
              className="rounded-xl gap-1 sm:gap-2 gradient-primary shadow-glow hover:shadow-lg transition-all h-8 px-2 sm:px-3 text-xs sm:text-sm ml-auto">
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {isSubmitting ? 'Đang đăng...' : 'Đăng'}
            </Button>
          </div>
        </div>
      </div>
    </div>);

});

CreatePost.displayName = 'CreatePost';