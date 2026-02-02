import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PostCard } from '@/components/post/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Profile as ProfileType, Post, Friendship } from '@/types/database';
import { MessageCircle, UserPlus, UserCheck, Camera, Calendar, Hash, Edit } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const Profile = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile: currentUserProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        // Use public_profiles view for viewing other users (excludes registration_ip)
        // Use profiles table only for own profile (allowed by RLS)
        const isViewingOwnProfile = user?.id === id;
        
        let profileData;
        if (isViewingOwnProfile) {
          // User can view their own full profile
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (error) throw error;
          profileData = data;
        } else {
          // Use public_profiles view for other users (no registration_ip)
          const { data, error } = await supabase
            .from('public_profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (error) throw error;
          profileData = data;
        }

        setProfile(profileData as ProfileType | null);

        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false });

        if (postsError) throw postsError;
        
        // Add profile to posts
        const postsWithProfile = (postsData || []).map(post => ({
          ...post,
          profiles: profileData
        }));
        setPosts(postsWithProfile as Post[]);

        // Check friendship status
        if (user && user.id !== id) {
          const { data: friendshipData } = await supabase
            .from('friendships')
            .select('*')
            .or(
              `and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`
            )
            .maybeSingle();

          setFriendship(friendshipData as Friendship | null);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [id, user]);

  const handleAddFriend = async () => {
    if (!user || !id) return;

    try {
      const { error } = await supabase.from('friendships').insert({
        requester_id: user.id,
        addressee_id: id,
      });

      if (error) throw error;

      setFriendship({
        id: '',
        requester_id: user.id,
        addressee_id: id,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      toast({
        title: 'Đã gửi lời mời kết bạn',
        description: 'Đang chờ người dùng chấp nhận.',
      });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi lời mời kết bạn.',
        variant: 'destructive',
      });
    }
  };

  const handleAcceptFriend = async () => {
    if (!friendship) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendship.id);

      if (error) throw error;

      setFriendship({ ...friendship, status: 'accepted' });

      toast({
        title: 'Đã chấp nhận lời mời',
        description: 'Các bạn đã trở thành bạn bè.',
      });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể chấp nhận lời mời.',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Lỗi',
        description: 'Ảnh không được vượt quá 2MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setProfile((prev) => prev ? { ...prev, avatar_url: `${publicUrl}?t=${Date.now()}` } : null);

      toast({
        title: 'Cập nhật thành công',
        description: 'Ảnh đại diện đã được cập nhật.',
      });
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật ảnh đại diện.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const getFriendshipButton = () => {
    if (isOwnProfile) {
      return null;
    }

    if (!friendship) {
      return (
        <Button onClick={handleAddFriend} className="rounded-xl gap-2 gradient-primary shadow-glow">
          <UserPlus className="w-4 h-4" />
          Thêm bạn
        </Button>
      );
    }

    if (friendship.status === 'accepted') {
      return (
        <Button variant="secondary" className="rounded-xl gap-2">
          <UserCheck className="w-4 h-4" />
          Bạn bè
        </Button>
      );
    }

    if (friendship.status === 'pending') {
      if (friendship.requester_id === user?.id) {
        return (
          <Button variant="secondary" className="rounded-xl gap-2" disabled>
            Đã gửi lời mời
          </Button>
        );
      }
      return (
        <Button onClick={handleAcceptFriend} className="rounded-xl gap-2 gradient-primary shadow-glow">
          Chấp nhận lời mời
        </Button>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="glass rounded-2xl overflow-hidden animate-shimmer">
            <div className="h-48 bg-muted" />
            <div className="p-6 -mt-16 relative">
              <div className="w-32 h-32 rounded-2xl bg-muted border-4 border-background" />
              <div className="mt-4 space-y-3">
                <div className="h-6 w-48 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-2xl p-12 text-center">
            <h2 className="text-2xl font-bold mb-2">Không tìm thấy người dùng</h2>
            <p className="text-muted-foreground">Người dùng này không tồn tại hoặc đã bị xóa.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Header */}
        <div className="glass rounded-2xl overflow-hidden animate-fade-in">
          {/* Cover Image */}
          <div className="h-48 md:h-64 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/20 relative">
            {profile.cover_url && (
              <img
                src={profile.cover_url}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Profile Info */}
          <div className="px-6 pb-6 -mt-16 relative">
            {/* Avatar */}
            <div className="relative inline-block">
              <Avatar className={cn(
                "w-32 h-32 border-4 border-background ring-4 ring-primary/20",
                isUpdatingAvatar && "opacity-50"
              )}>
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                  {profile.display_name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <Button
                    size="icon"
                    className="absolute bottom-0 right-0 rounded-full h-10 w-10 gradient-primary shadow-glow"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUpdatingAvatar}
                  >
                    <Camera className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>

            {/* User Info */}
            <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{profile.display_name || profile.username}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Hash className="w-4 h-4" />
                    <span>{profile.user_id_code}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Tham gia {formatDistanceToNow(new Date(profile.created_at), {
                        addSuffix: true,
                        locale: vi,
                      })}
                    </span>
                  </div>
                </div>
                {profile.bio && (
                  <p className="mt-3 text-foreground max-w-lg">{profile.bio}</p>
                )}
              </div>

              <div className="flex gap-2">
                {!isOwnProfile && (
                  <Button asChild variant="outline" className="rounded-xl gap-2">
                    <Link to={`/messages?user=${id}`}>
                      <MessageCircle className="w-4 h-4" />
                      Nhắn tin
                    </Link>
                  </Button>
                )}
                {getFriendshipButton()}
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Bài viết</h2>
          {posts.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-muted-foreground">Chưa có bài viết nào</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Profile;
