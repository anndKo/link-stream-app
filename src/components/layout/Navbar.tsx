import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, User, Settings, LogOut, Menu, X, Search, Bell, Shield, UserPlus, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface NotificationData {
  type: 'friend_request' | 'unread_messages' | 'trading_messages';
  count?: number;
  fromUser?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  friendshipId?: string;
  created_at?: string;
}

export const Navbar = () => {
  const {
    user,
    profile,
    isAdmin,
    signOut
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const previousUnreadRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log('Could not play notification sound:', err);
      });
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch pending friend requests
      const {
        data: friendRequests
      } = await supabase.from('friendships').select('id, created_at, requester_id').eq('addressee_id', user.id).eq('status', 'pending');

      // Fetch unread messages count
      const {
        data: unreadMessages
      } = await supabase.from('messages').select('sender_id').eq('receiver_id', user.id).eq('is_read', false);

      // Fetch unread trading messages count
      const {
        data: unreadTradingMessages
      } = await supabase.from('transaction_messages').select('sender_id').eq('receiver_id', user.id).eq('is_read', false);

      const notifs: NotificationData[] = [];

      // Get requester profiles for friend requests
      if (friendRequests && friendRequests.length > 0) {
        const requesterIds = friendRequests.map(fr => fr.requester_id);
        const {
          data: profiles
        } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', requesterIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        friendRequests.forEach(fr => {
          const fromProfile = profileMap.get(fr.requester_id);
          if (fromProfile) {
            notifs.push({
              type: 'friend_request',
              fromUser: fromProfile,
              friendshipId: fr.id,
              created_at: fr.created_at
            });
          }
        });
      }

      // Group unread messages by sender
      if (unreadMessages && unreadMessages.length > 0) {
        const senderCounts = new Map<string, number>();
        unreadMessages.forEach(msg => {
          senderCounts.set(msg.sender_id, (senderCounts.get(msg.sender_id) || 0) + 1);
        });
        const senderIds = [...senderCounts.keys()];
        const {
          data: senderProfiles
        } = await supabase.from('public_profiles').select('id, display_name, avatar_url').in('id', senderIds);
        senderProfiles?.forEach(sender => {
          if (sender.id) {
            notifs.push({
              type: 'unread_messages',
              count: senderCounts.get(sender.id) || 0,
              fromUser: {
                id: sender.id,
                display_name: sender.display_name || 'Người dùng',
                avatar_url: sender.avatar_url
              }
            });
          }
        });
      }

      // Group unread trading messages by sender
      if (unreadTradingMessages && unreadTradingMessages.length > 0) {
        const senderCounts = new Map<string, number>();
        unreadTradingMessages.forEach(msg => {
          senderCounts.set(msg.sender_id, (senderCounts.get(msg.sender_id) || 0) + 1);
        });
        const senderIds = [...senderCounts.keys()];
        const {
          data: senderProfiles
        } = await supabase.from('public_profiles').select('id, display_name, avatar_url').in('id', senderIds);
        senderProfiles?.forEach(sender => {
          notifs.push({
            type: 'trading_messages',
            count: senderCounts.get(sender.id) || 0,
            fromUser: sender
          });
        });
      }

      // Calculate new total
      const newTotal = notifs.length;
      
      // Play sound if there are new notifications
      if (newTotal > previousUnreadRef.current && previousUnreadRef.current > 0) {
        playNotificationSound();
      }
      
      previousUnreadRef.current = newTotal;
      setNotifications(notifs);
      setTotalUnread(newTotal);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [user, playNotificationSound]);

  useEffect(() => {
    fetchNotifications();

    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Subscribe to realtime changes for new messages and updates
  useEffect(() => {
    if (!user) return;

    const messageChannel = supabase
      .channel('navbar-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          playNotificationSound();
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          // Refresh notifications when messages are marked as read
          fetchNotifications();
        }
      )
      .subscribe();

    const tradingChannel = supabase
      .channel('navbar-trading-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          playNotificationSound();
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transaction_messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          // Refresh notifications when trading messages are marked as read
          fetchNotifications();
        }
      )
      .subscribe();

    const friendshipChannel = supabase
      .channel('navbar-friendships')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friendships',
          filter: `addressee_id=eq.${user.id}`
        },
        () => {
          playNotificationSound();
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'friendships'
        },
        () => {
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'friendships'
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(tradingChannel);
      supabase.removeChannel(friendshipChannel);
    };
  }, [user, fetchNotifications, playNotificationSound]);

  const handleAcceptFriend = async (friendshipId: string) => {
    try {
      await supabase.from('friendships').update({
        status: 'accepted'
      }).eq('id', friendshipId);
      fetchNotifications();
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const handleDeclineFriend = async (friendshipId: string) => {
    try {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      fetchNotifications();
    } catch (error) {
      console.error('Error declining friend request:', error);
    }
  };

  // Mark messages as read when clicking on notification
  const handleMarkMessagesAsRead = async (senderId: string, type: 'messages' | 'trading') => {
    // Remove notification from local state immediately for better UX
    setNotifications(prev => prev.filter(n => {
      if (type === 'messages' && n.type === 'unread_messages' && n.fromUser?.id === senderId) return false;
      if (type === 'trading' && n.type === 'trading_messages' && n.fromUser?.id === senderId) return false;
      return true;
    }));
    setTotalUnread(prev => Math.max(0, prev - 1));

    try {
      if (type === 'messages') {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('sender_id', senderId)
          .eq('receiver_id', user?.id)
          .eq('is_read', false);
      } else {
        await supabase
          .from('transaction_messages')
          .update({ is_read: true })
          .eq('sender_id', senderId)
          .eq('receiver_id', user?.id)
          .eq('is_read', false);
      }
      // Refetch to sync with server state
      fetchNotifications();
    } catch (error) {
      console.error('Error marking messages as read:', error);
      // Refetch to restore correct state on error
      fetchNotifications();
    }
  };

  const navItems = [{
    href: '/',
    icon: Home,
    label: 'Trang chủ'
  }, {
    href: '/trading',
    icon: Sparkles,
    label: 'Giao dịch'
  }, {
    href: '/messages',
    icon: MessageCircle,
    label: 'Tin nhắn'
  }, {
    href: '/search',
    icon: Search,
    label: 'Tìm kiếm'
  }, {
    href: '/friends',
    icon: UserPlus,
    label: 'Bạn bè'
  }];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!user) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <span className="text-xl font-bold text-primary-foreground">A</span>
            </div>
            <span className="text-xl font-bold gradient-text hidden sm:block">Annd</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <Link 
                key={item.href} 
                to={item.href} 
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200', 
                  location.pathname === item.href 
                    ? 'bg-primary text-primary-foreground shadow-glow' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-xl">
                  <Bell className="w-5 h-5" />
                  {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-[10px] flex items-center justify-center text-destructive-foreground font-bold animate-pulse">
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80 glass max-h-96 overflow-y-auto" align="end">
                <div className="p-3 border-b border-border">
                  <h3 className="font-semibold">Thông báo</h3>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Không có thông báo mới</p>
                  </div>
                ) : (
                  notifications.map((notif, index) => (
                    <div key={index} className="p-3 hover:bg-secondary/50 border-b border-border/50 last:border-0">
                      {notif.type === 'friend_request' && (
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={notif.fromUser?.avatar_url || ''} />
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {notif.fromUser?.display_name?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                              <UserPlus className="w-3 h-3 text-primary-foreground" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-semibold">{notif.fromUser?.display_name}</span>
                              {' '}đã gửi lời mời kết bạn
                            </p>
                            {notif.created_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(notif.created_at), {
                                  addSuffix: true,
                                  locale: vi
                                })}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2">
                              <Button 
                                size="sm" 
                                className="h-7 text-xs rounded-lg" 
                                onClick={() => notif.friendshipId && handleAcceptFriend(notif.friendshipId)}
                              >
                                Chấp nhận
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-xs rounded-lg" 
                                onClick={() => notif.friendshipId && handleDeclineFriend(notif.friendshipId)}
                              >
                                Từ chối
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {notif.type === 'unread_messages' && (
                        <Link 
                          to={`/messages?user=${notif.fromUser?.id}`} 
                          className="flex items-center gap-3"
                          onClick={() => notif.fromUser?.id && handleMarkMessagesAsRead(notif.fromUser.id, 'messages')}
                        >
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={notif.fromUser?.avatar_url || ''} />
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {notif.fromUser?.display_name?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                              <MessageCircle className="w-3 h-3 text-accent-foreground" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-semibold">{notif.fromUser?.display_name}</span>
                              {' '}đã gửi {notif.count} tin nhắn chưa đọc
                            </p>
                          </div>
                        </Link>
                      )}
                      {notif.type === 'trading_messages' && (
                        <Link 
                          to="/trading" 
                          className="flex items-center gap-3"
                          onClick={() => notif.fromUser?.id && handleMarkMessagesAsRead(notif.fromUser.id, 'trading')}
                        >
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={notif.fromUser?.avatar_url || ''} />
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {notif.fromUser?.display_name?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-warning rounded-full flex items-center justify-center">
                              <Sparkles className="w-3 h-3 text-warning-foreground" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-semibold">{notif.fromUser?.display_name}</span>
                              {' '}đã gửi {notif.count} tin nhắn giao dịch
                            </p>
                            <p className="text-xs text-muted-foreground">Nhấn để xem</p>
                          </div>
                        </Link>
                      )}
                    </div>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-xl">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                    <AvatarImage src={profile?.avatar_url || ''} alt={profile?.display_name || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 glass" align="end">
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-semibold">{profile?.display_name}</span>
                    <span className="text-xs text-muted-foreground">@{profile?.username}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={`/profile/${profile?.id}`} className="flex items-center gap-2 cursor-pointer">
                    <User className="w-4 h-4" />
                    <span>Hồ sơ của tôi</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="w-4 h-4" />
                    <span>Cài đặt</span>
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2 cursor-pointer text-accent">
                        <Shield className="w-4 h-4" />
                        <span>Quản trị</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSignOut} 
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden rounded-xl" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden glass border-t border-border/50 animate-slide-up">
          <div className="px-4 py-3 space-y-2">
            {navItems.map(item => (
              <Link 
                key={item.href} 
                to={item.href} 
                onClick={() => setMobileMenuOpen(false)} 
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200', 
                  location.pathname === item.href 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};