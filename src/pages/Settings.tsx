import { useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, User, Save, Hash, Camera, Sun, Moon, Copy, Check } from 'lucide-react';
import { AvatarCropDialog } from '@/components/ui/avatar-crop-dialog';
import { useTheme } from 'next-themes';

const Settings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isDark = resolvedTheme === 'dark';

  const handleCopyId = async () => {
    if (profile?.user_id_code) {
      await navigator.clipboard.writeText(profile.user_id_code);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      toast({ title: 'Đã sao chép', description: 'ID tài khoản đã được sao chép.' });
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Lỗi', description: 'Chỉ hỗ trợ JPG, PNG, WEBP', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setCropImageSrc(reader.result as string); setCropDialogOpen(true); };
    reader.readAsDataURL(file);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    if (!user) return;
    setCropDialogOpen(false);
    setIsUpdatingAvatar(true);
    try {
      const fileName = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const newUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      await refreshProfile();
      toast({ title: 'Cập nhật thành công', description: 'Ảnh đại diện đã được cập nhật.' });
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast({ title: 'Lỗi', description: 'Không thể cập nhật ảnh đại diện.', variant: 'destructive' });
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || profile.username,
          bio: bio.trim() || null,
        })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: 'Cập nhật thành công', description: 'Thông tin cá nhân đã được lưu.' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật thông tin. Vui lòng thử lại.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <SettingsIcon className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Cài đặt</h1>
            <p className="text-muted-foreground">Quản lý thông tin cá nhân của bạn</p>
          </div>
        </div>

        {/* Section 1: Chỉnh sửa thông tin cá nhân */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Chỉnh sửa thông tin cá nhân
          </h2>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
            <div className="relative">
              <Avatar className={`h-20 w-20 ring-4 ring-primary/20 ${isUpdatingAvatar ? 'opacity-50' : ''}`}>
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarSelect} className="hidden" />
              <Button size="icon" className="absolute -bottom-1 -right-1 rounded-full h-8 w-8 gradient-primary shadow-glow" onClick={() => avatarInputRef.current?.click()} disabled={isUpdatingAvatar}>
                <Camera className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <h3 className="text-xl font-bold">{profile?.display_name}</h3>
              <p className="text-muted-foreground">@{profile?.username}</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Username (read-only) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Tên người dùng
              </Label>
              <Input value={profile?.username || ''} disabled className="rounded-xl bg-secondary/50" />
              <p className="text-xs text-muted-foreground">Tên người dùng không thể thay đổi</p>
            </div>

            {/* User ID (read-only with copy) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Hash className="w-4 h-4" />
                ID người dùng
              </Label>
              <div className="flex gap-2">
                <Input value={profile?.user_id_code || ''} disabled className="rounded-xl bg-secondary/50 font-mono flex-1" />
                <Button variant="outline" size="icon" className="rounded-xl flex-shrink-0" onClick={handleCopyId}>
                  {copiedId ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">ID này dùng để người khác tìm kiếm bạn</p>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label>Tên hiển thị</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên hiển thị"
                className="rounded-xl"
              />
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label>Giới thiệu</Label>
              <Textarea
                value={bio}
                onChange={(e) => {
                  const words = e.target.value.split(/\s+/).filter(Boolean);
                  if (words.length <= 500 || e.target.value.length < bio.length) {
                    setBio(e.target.value);
                  }
                }}
                placeholder="Viết gì đó về bản thân..."
                className="rounded-xl resize-none min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground text-right">
                {bio.split(/\s+/).filter(Boolean).length}/500 từ
              </p>
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full rounded-xl gradient-primary shadow-glow gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>

        {/* Section 2: Chế độ hiển thị */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {isDark ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
            Chế độ hiển thị
          </h2>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              <div>
                <p className="font-medium">{isDark ? 'Chế độ tối' : 'Chế độ sáng'}</p>
                <p className="text-xs text-muted-foreground">
                  {isDark ? 'Giao diện tối giúp giảm mỏi mắt' : 'Giao diện sáng cho ban ngày'}
                </p>
              </div>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </div>
      </div>

      {cropImageSrc && (
        <AvatarCropDialog
          open={cropDialogOpen}
          onClose={() => setCropDialogOpen(false)}
          imageSrc={cropImageSrc}
          onCropComplete={handleCroppedAvatar}
        />
      )}
    </MainLayout>
  );
};

export default Settings;
