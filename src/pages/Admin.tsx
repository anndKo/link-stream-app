import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Profile, Post, Report, Message, TransactionPost, PaymentBox, AdminPaymentBoxSettings } from '@/types/database';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import {
  Shield,
  Users,
  FileText,
  Flag,
  Trash2,
  Ban,
  Search,
  MessageCircle,
  ShoppingCart,
  CreditCard,
  ImagePlus,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const Admin = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [transactionPosts, setTransactionPosts] = useState<TransactionPost[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [paymentBoxes, setPaymentBoxes] = useState<PaymentBox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [showMessagesDialog, setShowMessagesDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  
  // Admin payment box settings
  const [adminSettings, setAdminSettings] = useState<AdminPaymentBoxSettings | null>(null);
  const [paymentBoxImage, setPaymentBoxImage] = useState<File | null>(null);
  const [paymentBoxImagePreview, setPaymentBoxImagePreview] = useState<string | null>(null);
  const [paymentBoxContent, setPaymentBoxContent] = useState('');
  const [transactionFee, setTransactionFee] = useState('');
  const [hasFee, setHasFee] = useState(true);
  const [isUploadingPaymentBox, setIsUploadingPaymentBox] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
      fetchAdminSettings();
    }
  }, [isAdmin]);

  const fetchAdminSettings = async () => {
    const { data } = await supabase
      .from('admin_payment_box_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setAdminSettings(data as AdminPaymentBoxSettings);
      setPaymentBoxContent(data.content || '');
      setPaymentBoxImagePreview(data.image_url || null);
      setTransactionFee(data.transaction_fee || '');
      setHasFee(data.has_fee ?? true);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, postsRes, transactionPostsRes, reportsRes, paymentBoxesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('posts').select('*').order('created_at', { ascending: false }),
        supabase.from('transaction_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
        supabase.from('payment_boxes').select('*').order('created_at', { ascending: false }),
      ]);

      if (usersRes.data) setUsers(usersRes.data as Profile[]);
      
      // Add profiles to posts
      if (postsRes.data && usersRes.data) {
        const profilesMap = new Map(usersRes.data.map(p => [p.id, p]));
        const postsWithProfiles = postsRes.data.map(post => ({
          ...post,
          profiles: profilesMap.get(post.user_id)
        }));
        setPosts(postsWithProfiles as Post[]);
      }

      // Add profiles to transaction posts
      if (transactionPostsRes.data && usersRes.data) {
        const profilesMap = new Map(usersRes.data.map(p => [p.id, p]));
        const postsWithProfiles = transactionPostsRes.data.map(post => ({
          ...post,
          profiles: profilesMap.get(post.user_id)
        }));
        setTransactionPosts(postsWithProfiles as TransactionPost[]);
      }
      
      // Add profiles to reports
      if (reportsRes.data && usersRes.data) {
        const profilesMap = new Map(usersRes.data.map(p => [p.id, p]));
        const reportsWithProfiles = reportsRes.data.map(report => ({
          ...report,
          reporter_profile: profilesMap.get(report.reporter_id),
          reported_profile: profilesMap.get(report.reported_user_id)
        }));
        setReports(reportsWithProfiles as Report[]);
      }

      // Add profiles to payment boxes
      if (paymentBoxesRes.data && usersRes.data) {
        const profilesMap = new Map(usersRes.data.map(p => [p.id, p]));
        const boxesWithProfiles = paymentBoxesRes.data.map(box => ({
          ...box,
          sender_profile: profilesMap.get(box.sender_id),
          receiver_profile: profilesMap.get(box.receiver_id)
        }));
        setPaymentBoxes(boxesWithProfiles as PaymentBox[]);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !banReason.trim()) {
      toast({ title: 'Vui lòng nhập lý do xóa tài khoản', variant: 'destructive' });
      return;
    }

    try {
      // Get the user's registration IP to ban it
      const userToBan = users.find(u => u.id === userToDelete);
      
      // Update profile with ban reason and is_banned flag first
      await supabase
        .from('profiles')
        .update({ is_banned: true, ban_reason: banReason.trim() })
        .eq('id', userToDelete);

      // If user has registration IP, ban it
      if (userToBan?.registration_ip) {
        await supabase.from('banned_ips').insert({
          ip_address: userToBan.registration_ip,
          reason: `Xóa tài khoản: ${banReason.trim()}`,
          banned_by: users.find(u => u.id === userToDelete)?.id
        });
      }

      // Delete all posts by this user
      await supabase.from('posts').delete().eq('user_id', userToDelete);
      
      // Delete all transaction posts by this user
      await supabase.from('transaction_posts').delete().eq('user_id', userToDelete);
      
      // Delete all messages by this user
      await supabase.from('messages').delete().eq('sender_id', userToDelete);
      await supabase.from('transaction_messages').delete().eq('sender_id', userToDelete);
      
      // Delete all comments by this user
      await supabase.from('comments').delete().eq('user_id', userToDelete);
      
      // Delete all likes by this user
      await supabase.from('likes').delete().eq('user_id', userToDelete);
      
      // Delete all friendships
      await supabase.from('friendships').delete().or(`requester_id.eq.${userToDelete},addressee_id.eq.${userToDelete}`);

      // Remove user from local state completely (deleted users don't show in list)
      setUsers(prev => prev.filter(u => u.id !== userToDelete));
      setPosts(prev => prev.filter((p) => p.user_id !== userToDelete));
      setTransactionPosts(prev => prev.filter((p) => p.user_id !== userToDelete));
      
      toast({ title: 'Đã xóa tài khoản và chặn IP của người dùng' });
      setShowDeleteDialog(false);
      setUserToDelete(null);
      setBanReason('');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ title: 'Lỗi', description: 'Không thể xóa người dùng', variant: 'destructive' });
    }
  };

  const handleBanUser = async (userId: string) => {
    const reason = prompt('Nhập lý do chặn tài khoản:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: true, ban_reason: reason })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map((u) => (u.id === userId ? { ...u, is_banned: true, ban_reason: reason } : u)));
      toast({ title: 'Đã chặn người dùng' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể chặn người dùng', variant: 'destructive' });
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Bạn có chắc muốn xóa bài viết này?')) return;

    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;

      setPosts(posts.filter((p) => p.id !== postId));
      toast({ title: 'Đã xóa bài viết' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể xóa bài viết', variant: 'destructive' });
    }
  };

  const handleDeleteTransactionPost = async (postId: string) => {
    if (!confirm('Bạn có chắc muốn xóa bài viết giao dịch này?')) return;

    try {
      const { error } = await supabase.from('transaction_posts').delete().eq('id', postId);
      if (error) throw error;

      setTransactionPosts(transactionPosts.filter((p) => p.id !== postId));
      toast({ title: 'Đã xóa bài viết giao dịch' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể xóa bài viết giao dịch', variant: 'destructive' });
    }
  };

  const handleViewMessages = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setSelectedUser(user);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Add profiles to messages
      const userIds = [...new Set((data || []).flatMap(m => [m.sender_id, m.receiver_id]))];
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds);
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      
      const messagesWithProfiles = (data || []).map(msg => ({
        ...msg,
        sender_profile: profilesMap.get(msg.sender_id),
        receiver_profile: profilesMap.get(msg.receiver_id)
      }));
      
      setUserMessages(messagesWithProfiles as Message[]);
      setShowMessagesDialog(true);
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể tải tin nhắn', variant: 'destructive' });
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'resolved' })
        .eq('id', reportId);

      if (error) throw error;

      setReports(reports.map((r) => (r.id === reportId ? { ...r, status: 'resolved' as const } : r)));
      toast({ title: 'Đã xử lý báo cáo' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật báo cáo', variant: 'destructive' });
    }
  };

  // Handle payment box image
  const handlePaymentBoxImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentBoxImage(file);
      setPaymentBoxImagePreview(URL.createObjectURL(file));
    }
  };

  // Save admin payment box settings
  const handleSavePaymentBoxSettings = async () => {
    setIsUploadingPaymentBox(true);
    try {
      let imageUrl = adminSettings?.image_url || null;

      if (paymentBoxImage) {
        const fileExt = paymentBoxImage.name.split('.').pop();
        const fileName = `admin/payment-box-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, paymentBoxImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const settingsData = {
        image_url: imageUrl, 
        content: paymentBoxContent.trim() || null,
        transaction_fee: transactionFee.trim() || null,
        has_fee: hasFee,
        updated_at: new Date().toISOString()
      };

      if (adminSettings) {
        // Update existing
        const { error } = await supabase
          .from('admin_payment_box_settings')
          .update(settingsData)
          .eq('id', adminSettings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('admin_payment_box_settings')
          .insert(settingsData)
          .select()
          .single();

        if (error) throw error;
        setAdminSettings(data as AdminPaymentBoxSettings);
      }

      toast({ title: 'Đã lưu cài đặt hộp thanh toán' });
      setPaymentBoxImage(null);
      fetchAdminSettings();
    } catch (error) {
      console.error('Error saving payment box settings:', error);
      toast({ title: 'Lỗi', description: 'Không thể lưu cài đặt', variant: 'destructive' });
    } finally {
      setIsUploadingPaymentBox(false);
    }
  };

  // Confirm payment box (admin approves buyer's payment)
  const handleConfirmPaymentBox = async (boxId: string) => {
    try {
      const { error } = await supabase
        .from('payment_boxes')
        .update({ 
          status: 'admin_confirmed', 
          admin_confirmed_at: new Date().toISOString() 
        })
        .eq('id', boxId);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === boxId ? { ...box, status: 'admin_confirmed' as const, admin_confirmed_at: new Date().toISOString() } : box
      ));
      toast({ title: 'Đã xác nhận giao dịch' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể xác nhận giao dịch', variant: 'destructive' });
    }
  };

  // Approve refund
  const handleApproveRefund = async (boxId: string) => {
    try {
      const { error } = await supabase
        .from('payment_boxes')
        .update({ 
          status: 'refunded', 
          refund_approved_at: new Date().toISOString() 
        })
        .eq('id', boxId);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === boxId ? { ...box, status: 'refunded' as const, refund_approved_at: new Date().toISOString() } : box
      ));
      toast({ title: 'Đã chấp nhận hoàn tiền' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể xử lý hoàn tiền', variant: 'destructive' });
    }
  };

  const handleDeletePaymentBox = async (boxId: string) => {
    if (!confirm('Bạn có chắc muốn xóa hộp thanh toán này?')) return;

    try {
      const { error } = await supabase.from('payment_boxes').delete().eq('id', boxId);
      if (error) throw error;

      setPaymentBoxes(paymentBoxes.filter((b) => b.id !== boxId));
      toast({ title: 'Đã xóa hộp thanh toán' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể xóa hộp thanh toán', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Chờ người mua</Badge>;
      case 'buyer_paid':
        return <Badge variant="outline" className="border-warning text-warning">Chờ xác nhận TT</Badge>;
      case 'admin_confirmed':
        return <Badge variant="default" className="bg-green-500">Đang giao dịch</Badge>;
      case 'seller_completed':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Đã bàn giao</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Đã hủy</Badge>;
      case 'refund_requested':
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Yêu cầu hoàn tiền</Badge>;
      case 'refunded':
        return <Badge variant="secondary">Đã hoàn tiền</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Bị từ chối</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Hoàn tất</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Complete transaction (final admin confirmation after seller requests money)
  const handleCompleteTransaction = async (boxId: string) => {
    try {
      const { error } = await supabase
        .from('payment_boxes')
        .update({ 
          status: 'completed'
        })
        .eq('id', boxId);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === boxId ? { ...box, status: 'completed' as const } : box
      ));
      toast({ title: 'Đã hoàn tất giao dịch' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể hoàn tất giao dịch', variant: 'destructive' });
    }
  };

  // Filter out deleted users (is_banned with reason) and apply search
  const filteredUsers = users.filter(
    (u) =>
      !u.is_banned && // Don't show banned/deleted users
      (u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.user_id_code?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 rounded-xl gradient-primary animate-pulse-slow" />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Quản trị viên</h1>
            <p className="text-muted-foreground">Quản lý người dùng, bài viết và báo cáo</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {[
            { label: 'Người dùng', value: users.length, icon: Users, color: 'text-primary' },
            { label: 'Bài viết', value: posts.length, icon: FileText, color: 'text-success' },
            { label: 'Giao dịch', value: transactionPosts.length, icon: ShoppingCart, color: 'text-blue-500' },
            { label: 'Hộp TT', value: paymentBoxes.length, icon: CreditCard, color: 'text-purple-500' },
            { label: 'Báo cáo', value: reports.filter((r) => r.status === 'pending').length, icon: Flag, color: 'text-warning' },
            { label: 'Bị chặn', value: users.filter((u) => u.is_banned).length, icon: Ban, color: 'text-destructive' },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="glass p-1 rounded-xl flex-wrap h-auto">
            <TabsTrigger value="users" className="rounded-lg gap-2">
              <Users className="w-4 h-4" />
              Người dùng
            </TabsTrigger>
            <TabsTrigger value="posts" className="rounded-lg gap-2">
              <FileText className="w-4 h-4" />
              Bài viết
            </TabsTrigger>
            <TabsTrigger value="transaction-posts" className="rounded-lg gap-2">
              <ShoppingCart className="w-4 h-4" />
              Giao dịch
            </TabsTrigger>
            <TabsTrigger value="reports" className="rounded-lg gap-2">
              <Flag className="w-4 h-4" />
              Báo cáo
              {reports.filter((r) => r.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {reports.filter((r) => r.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payment-boxes" className="rounded-lg gap-2">
              <CreditCard className="w-4 h-4" />
              Hộp thanh toán
              {paymentBoxes.filter((b) => b.status === 'buyer_paid' || b.status === 'refund_requested').length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {paymentBoxes.filter((b) => b.status === 'buyer_paid' || b.status === 'refund_requested').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm người dùng..."
                className="pl-10 rounded-xl"
              />
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Ngày tham gia</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatar_url || ''} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {user.display_name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.display_name}</p>
                            <p className="text-sm text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{user.user_id_code}</TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(user.created_at), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </TableCell>
                      <TableCell>
                        {user.is_banned ? (
                          <Badge variant="destructive">Bị chặn</Badge>
                        ) : (
                          <Badge variant="secondary">Hoạt động</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg"
                            onClick={() => handleViewMessages(user.id)}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg"
                            onClick={() => handleBanUser(user.id)}
                            disabled={user.is_banned}
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg text-destructive hover:text-destructive"
                            onClick={() => {
                              setUserToDelete(user.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-4">
            <div className="glass rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người đăng</TableHead>
                    <TableHead>Nội dung</TableHead>
                    <TableHead>Ngày đăng</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={post.profiles?.avatar_url || ''} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {post.profiles?.display_name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{post.profiles?.display_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {post.content || (post.image_url ? '[Hình ảnh]' : '[Trống]')}
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(post.created_at), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg text-destructive hover:text-destructive"
                          onClick={() => handleDeletePost(post.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Transaction Posts Tab */}
          <TabsContent value="transaction-posts" className="space-y-4">
            <div className="glass rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người đăng</TableHead>
                    <TableHead>Nội dung</TableHead>
                    <TableHead>Ngày đăng</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionPosts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={post.profiles?.avatar_url || ''} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {post.profiles?.display_name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{post.profiles?.display_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {post.content || (post.image_url ? '[Hình ảnh]' : '[Trống]')}
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(post.created_at), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg text-destructive hover:text-destructive"
                          onClick={() => handleDeleteTransactionPost(post.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <div className="glass rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người báo cáo</TableHead>
                    <TableHead>Người bị báo cáo</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={report.reporter_profile?.avatar_url || ''} />
                            <AvatarFallback className="bg-secondary text-xs">
                              {report.reporter_profile?.display_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{report.reporter_profile?.display_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={report.reported_profile?.avatar_url || ''} />
                            <AvatarFallback className="bg-destructive/20 text-xs">
                              {report.reported_profile?.display_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{report.reported_profile?.display_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.reason}</Badge>
                        {report.description && (
                          <p className="text-sm text-muted-foreground mt-1 max-w-xs truncate">
                            {report.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {report.status === 'pending' ? (
                          <Badge variant="destructive">Chờ xử lý</Badge>
                        ) : report.status === 'reviewed' ? (
                          <Badge variant="secondary">Đã xem</Badge>
                        ) : (
                          <Badge variant="default">Đã xử lý</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg"
                            onClick={() => handleBanUser(report.reported_user_id)}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            Chặn
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg"
                            onClick={() => handleResolveReport(report.id)}
                            disabled={report.status === 'resolved'}
                          >
                            Xử lý
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Payment Boxes Tab */}
          <TabsContent value="payment-boxes" className="space-y-4">
            {/* Admin Payment Box Settings */}
            <div className="glass rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Cài đặt hộp thanh toán
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Nội dung hướng dẫn thanh toán</Label>
                    <Textarea
                      value={paymentBoxContent}
                      onChange={(e) => setPaymentBoxContent(e.target.value)}
                      placeholder="Nhập nội dung hướng dẫn thanh toán..."
                      className="rounded-xl mt-1 min-h-[100px]"
                    />
                  </div>
                  <div>
                    <Label>Phí giao dịch</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={hasFee}
                          onCheckedChange={setHasFee}
                        />
                        <span className="text-sm">{hasFee ? 'Có phí' : 'Miễn phí'}</span>
                      </div>
                      {hasFee && (
                        <Input
                          value={transactionFee}
                          onChange={(e) => setTransactionFee(e.target.value)}
                          placeholder="VD: 5% hoặc 10,000đ"
                          className="rounded-xl flex-1"
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Hình ảnh QR / Hướng dẫn</Label>
                  <div className="mt-2">
                    {paymentBoxImagePreview ? (
                      <div className="relative inline-block">
                        <img
                          src={paymentBoxImagePreview}
                          alt="Preview"
                          className="w-40 h-40 object-cover rounded-lg"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 w-6 h-6"
                          onClick={() => {
                            setPaymentBoxImage(null);
                            setPaymentBoxImagePreview(null);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                        <div className="w-40 h-40 border-2 border-dashed rounded-lg flex items-center justify-center">
                          <ImagePlus className="w-8 h-8" />
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePaymentBoxImageSelect}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <Button
                onClick={handleSavePaymentBoxSettings}
                disabled={isUploadingPaymentBox}
                className="rounded-xl"
              >
                {isUploadingPaymentBox ? 'Đang lưu...' : 'Lưu cài đặt'}
              </Button>
            </div>

            {/* Payment Boxes List */}
            <div className="glass rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người bán</TableHead>
                    <TableHead>Người mua</TableHead>
                    <TableHead>Thời gian TT</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentBoxes.map((box) => (
                    <TableRow key={box.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={box.sender_profile?.avatar_url || ''} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {box.sender_profile?.display_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{box.sender_profile?.display_name || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={box.receiver_profile?.avatar_url || ''} />
                            <AvatarFallback className="bg-secondary text-xs">
                              {box.receiver_profile?.display_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{box.receiver_profile?.display_name || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {box.payment_duration ? (
                          <span className="text-sm">
                            {box.payment_duration === 'custom' 
                              ? `${box.payment_duration_days} ngày` 
                              : box.payment_duration}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(box.status)}
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(box.created_at), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {box.status === 'buyer_paid' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-lg text-green-500 hover:text-green-600"
                              onClick={() => handleConfirmPaymentBox(box.id)}
                              title="Xác nhận thanh toán"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          {box.status === 'refund_requested' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-lg text-orange-500 hover:text-orange-600"
                              onClick={() => handleApproveRefund(box.id)}
                              title="Chấp nhận hoàn tiền"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          {(box as any).seller_confirmed_at && box.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-lg text-purple-500 hover:text-purple-600"
                              onClick={() => handleCompleteTransaction(box.id)}
                              title="Hoàn tất giao dịch"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg text-destructive hover:text-destructive"
                            onClick={() => handleDeletePaymentBox(box.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Messages Dialog */}
      <Dialog open={showMessagesDialog} onOpenChange={setShowMessagesDialog}>
        <DialogContent className="glass max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedUser?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {selectedUser?.display_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <span>Tin nhắn của {selectedUser?.display_name}</span>
                <p className="text-sm font-normal text-muted-foreground">
                  @{selectedUser?.username}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {userMessages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không có tin nhắn nào
              </p>
            ) : (
              userMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-3 rounded-xl bg-secondary/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {msg.sender_id === selectedUser?.id
                          ? selectedUser?.display_name
                          : msg.sender_profile?.display_name}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">
                        {msg.receiver_id === selectedUser?.id
                          ? selectedUser?.display_name
                          : msg.receiver_profile?.display_name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                        locale: vi,
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{msg.content}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Xóa tài khoản vĩnh viễn</DialogTitle>
            <DialogDescription>
              Tất cả dữ liệu của người dùng sẽ bị xóa vĩnh viễn. Khi họ đăng nhập lại sẽ nhận được thông báo tài khoản bị khóa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lý do xóa tài khoản</Label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Nhập lý do xóa tài khoản (sẽ hiển thị cho người dùng)..."
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setUserToDelete(null);
                  setBanReason('');
                }}
                className="flex-1 rounded-xl"
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
                disabled={!banReason.trim()}
                className="flex-1 rounded-xl"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Xóa vĩnh viễn
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Admin;
