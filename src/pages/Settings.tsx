import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, User, Save, Hash, Mail } from 'lucide-react';

const Settings = () => {
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isSaving, setIsSaving] = useState(false);

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
      toast({
        title: 'Cập nhật thành công',
        description: 'Thông tin cá nhân đã được lưu.',
      });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật thông tin. Vui lòng thử lại.',
        variant: 'destructive',
      });
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

        {/* Profile Card */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
            <Avatar className="h-20 w-20 ring-4 ring-primary/20">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{profile?.display_name}</h2>
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
              <Input
                value={profile?.username || ''}
                disabled
                className="rounded-xl bg-secondary/50"
              />
              <p className="text-xs text-muted-foreground">Tên người dùng không thể thay đổi</p>
            </div>

            {/* User ID (read-only) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Hash className="w-4 h-4" />
                ID người dùng
              </Label>
              <Input
                value={profile?.user_id_code || ''}
                disabled
                className="rounded-xl bg-secondary/50 font-mono"
              />
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
                onChange={(e) => setBio(e.target.value)}
                placeholder="Viết gì đó về bản thân..."
                className="rounded-xl resize-none min-h-[100px]"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full rounded-xl gradient-primary shadow-glow gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;
