import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Profile, Friendship } from '@/types/database';
import { MessageCircle, UserMinus, Users, UserPlus, Hash, Loader2, Check, X, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FriendWithProfile {
  friendship: Friendship;
  friend: Profile;
}

interface PendingRequest {
  friendship: Friendship;
  requester: Profile;
}

const Friends = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingFriendId, setDeletingFriendId] = useState<string | null>(null);
  const [friendToDelete, setFriendToDelete] = useState<FriendWithProfile | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch accepted friendships where user is either requester or addressee
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (error) throw error;

      if (!friendships || friendships.length === 0) {
        setFriends([]);
      } else {
        // Get friend IDs (the other person in each friendship)
        const friendIds = friendships.map(f => 
          f.requester_id === user.id ? f.addressee_id : f.requester_id
        );

        // Fetch friend profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('public_profiles')
          .select('*')
          .in('id', friendIds);

        if (profilesError) throw profilesError;

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const friendsWithProfiles: FriendWithProfile[] = friendships
          .map(f => {
            const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
            const friendProfile = profileMap.get(friendId);
            
            if (!friendProfile || friendProfile.is_banned) return null;

            return {
              friendship: f as Friendship,
              friend: friendProfile as Profile
            };
          })
          .filter(Boolean) as FriendWithProfile[];

        setFriends(friendsWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách bạn bè',
        variant: 'destructive'
      });
    }
  }, [user]);

  const fetchPendingRequests = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch pending friend requests where user is addressee
      const { data: requests, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('addressee_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;

      if (!requests || requests.length === 0) {
        setPendingRequests([]);
        return;
      }

      // Get requester IDs
      const requesterIds = requests.map(r => r.requester_id);

      // Fetch requester profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('public_profiles')
        .select('*')
        .in('id', requesterIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const requestsWithProfiles: PendingRequest[] = requests
        .map(r => {
          const requesterProfile = profileMap.get(r.requester_id);
          
          if (!requesterProfile || requesterProfile.is_banned) return null;

          return {
            friendship: r as Friendship,
            requester: requesterProfile as Profile
          };
        })
        .filter(Boolean) as PendingRequest[];

      setPendingRequests(requestsWithProfiles);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  }, [user]);

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchFriends(), fetchPendingRequests()]);
      setIsLoading(false);
    };
    fetchAll();
  }, [fetchFriends, fetchPendingRequests]);

  const handleAcceptRequest = async (friendshipId: string) => {
    setProcessingRequestId(friendshipId);
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: 'Đã chấp nhận lời mời kết bạn'
      });

      // Refresh both lists
      await Promise.all([fetchFriends(), fetchPendingRequests()]);
    } catch (error) {
      console.error('Error accepting request:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể chấp nhận lời mời',
        variant: 'destructive'
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    setProcessingRequestId(friendshipId);
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      toast({
        title: 'Đã từ chối',
        description: 'Đã từ chối lời mời kết bạn'
      });

      await fetchPendingRequests();
    } catch (error) {
      console.error('Error declining request:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể từ chối lời mời',
        variant: 'destructive'
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleUnfriend = async () => {
    if (!friendToDelete) return;

    setDeletingFriendId(friendToDelete.friendship.id);
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendToDelete.friendship.id);

      if (error) throw error;

      setFriends(prev => prev.filter(f => f.friendship.id !== friendToDelete.friendship.id));
      toast({
        title: 'Thành công',
        description: `Đã xóa ${friendToDelete.friend.display_name || friendToDelete.friend.username} khỏi danh sách bạn bè`
      });
    } catch (error) {
      console.error('Error unfriending:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa bạn bè',
        variant: 'destructive'
      });
    } finally {
      setDeletingFriendId(null);
      setFriendToDelete(null);
    }
  };

  const handleMessage = (friendId: string) => {
    navigate(`/messages?user=${friendId}`);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <p className="text-muted-foreground">Vui lòng đăng nhập để xem danh sách bạn bè</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <Users className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Bạn bè</h1>
          <p className="text-muted-foreground">
            Quản lý bạn bè và lời mời kết bạn
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-3">
          <Button
            onClick={() => navigate('/search')}
            className="rounded-xl gap-2 gradient-primary shadow-glow"
          >
            <UserPlus className="w-4 h-4" />
            Tìm bạn bè mới
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="friends" className="gap-2">
              <Users className="w-4 h-4" />
              Bạn bè ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2 relative">
              <Clock className="w-4 h-4" />
              Lời mời ({pendingRequests.length})
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-[10px] flex items-center justify-center text-destructive-foreground font-bold">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Friends List Tab */}
          <TabsContent value="friends" className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass rounded-2xl p-4 flex items-center gap-4 animate-shimmer">
                    <div className="w-14 h-14 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-3 w-24 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : friends.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Chưa có bạn bè</h3>
                <p className="text-muted-foreground mb-4">
                  Hãy tìm kiếm và kết bạn với người dùng khác!
                </p>
                <Button
                  onClick={() => navigate('/search')}
                  className="rounded-xl gap-2 gradient-primary"
                >
                  <UserPlus className="w-4 h-4" />
                  Tìm bạn bè
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.map(({ friendship, friend }) => (
                  <div
                    key={friendship.id}
                    className="glass rounded-2xl p-4 flex items-center gap-4 hover-lift animate-fade-in"
                  >
                    <Link to={`/profile/${friend.id}`}>
                      <Avatar className="h-14 w-14 ring-2 ring-primary/20 cursor-pointer hover:ring-primary/40 transition-all">
                        <AvatarImage src={friend.avatar_url || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                          {(friend.display_name || friend.username)?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/profile/${friend.id}`} className="hover:underline">
                        <h3 className="font-semibold text-lg truncate">
                          {friend.display_name || friend.username}
                        </h3>
                      </Link>
                      <p className="text-muted-foreground truncate">@{friend.username}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Hash className="w-3 h-3" />
                        <span>{friend.user_id_code}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1"
                        onClick={() => handleMessage(friend.id)}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Nhắn tin</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-xl gap-1"
                        onClick={() => setFriendToDelete({ friendship, friend })}
                        disabled={deletingFriendId === friendship.id}
                      >
                        {deletingFriendId === friendship.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserMinus className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Xóa</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Pending Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="glass rounded-2xl p-4 flex items-center gap-4 animate-shimmer">
                    <div className="w-14 h-14 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-3 w-24 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Không có lời mời</h3>
                <p className="text-muted-foreground">
                  Bạn không có lời mời kết bạn nào đang chờ
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map(({ friendship, requester }) => (
                  <div
                    key={friendship.id}
                    className="glass rounded-2xl p-4 flex items-center gap-4 hover-lift animate-fade-in"
                  >
                    <Link to={`/profile/${requester.id}`}>
                      <Avatar className="h-14 w-14 ring-2 ring-primary/20 cursor-pointer hover:ring-primary/40 transition-all">
                        <AvatarImage src={requester.avatar_url || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                          {(requester.display_name || requester.username)?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/profile/${requester.id}`} className="hover:underline">
                        <h3 className="font-semibold text-lg truncate">
                          {requester.display_name || requester.username}
                        </h3>
                      </Link>
                      <p className="text-muted-foreground truncate">@{requester.username}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Hash className="w-3 h-3" />
                        <span>{requester.user_id_code}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-xl gap-1 gradient-primary"
                        onClick={() => handleAcceptRequest(friendship.id)}
                        disabled={processingRequestId === friendship.id}
                      >
                        {processingRequestId === friendship.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Chấp nhận</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1"
                        onClick={() => handleDeclineRequest(friendship.id)}
                        disabled={processingRequestId === friendship.id}
                      >
                        <X className="w-4 h-4" />
                        <span className="hidden sm:inline">Từ chối</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={!!friendToDelete} onOpenChange={() => setFriendToDelete(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bạn bè</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa{' '}
              <span className="font-semibold">
                {friendToDelete?.friend.display_name || friendToDelete?.friend.username}
              </span>{' '}
              khỏi danh sách bạn bè? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnfriend}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa bạn bè
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Friends;
