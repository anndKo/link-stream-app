import { useState, useEffect, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImagePlus, Send, X, Search, Image as ImageIcon, Clock, Shuffle, List, Sparkles, MessageCircle, ArrowLeft, ArrowDown, MoreVertical, Flag, CreditCard, Check, XCircle, Trash2, RefreshCw, CheckCircle, Timer } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, differenceInDays, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { PaymentBoxStatus, AdminPaymentBoxSettings } from '@/types/database';

interface TradingPost {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  profiles?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface TradingMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface TradingConversation {
  id: string;
  participant: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  lastMessage: TradingMessage | null;
  unreadCount: number;
}

interface PaymentBox {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: PaymentBoxStatus;
  created_at: string;
  confirmed_at: string | null;
  image_url: string | null;
  content: string | null;
  payment_duration: string | null;
  payment_duration_days: number | null;
  admin_confirmed_at: string | null;
  seller_cancelled_at: string | null;
  refund_requested_at: string | null;
  refund_approved_at: string | null;
  transaction_start_at?: string | null;
  seller_completed_at?: string | null;
  buyer_confirmed_at?: string | null;
  buyer_bank_account?: string | null;
  buyer_bank_name?: string | null;
  refund_reason?: string | null;
  seller_bank_account?: string | null;
  seller_bank_name?: string | null;
  seller_confirmed_at?: string | null;
}

const Trading = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Posts state
  const [posts, setPosts] = useState<TradingPost[]>([]);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [postFilter, setPostFilter] = useState<'newest' | 'random' | 'all'>('newest');
  const [isPostLoading, setIsPostLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Messages state
  const [conversations, setConversations] = useState<TradingConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<TradingMessage[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [messageImage, setMessageImage] = useState<File | null>(null);
  const [messageImagePreview, setMessageImagePreview] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [showPaymentBoxDialog, setShowPaymentBoxDialog] = useState(false);
  const [paymentBoxes, setPaymentBoxes] = useState<PaymentBox[]>([]);
  const [adminPaymentSettings, setAdminPaymentSettings] = useState<AdminPaymentBoxSettings | null>(null);
  
  // Payment duration dialog
  const [showPaymentDurationDialog, setShowPaymentDurationDialog] = useState(false);
  const [selectedPaymentBoxId, setSelectedPaymentBoxId] = useState<string | null>(null);
  const [paymentDuration, setPaymentDuration] = useState<string>('');
  const [customDays, setCustomDays] = useState<string>('');

  // Refund dialog
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundBankAccount, setRefundBankAccount] = useState('');

  // Seller receive money dialog
  const [showReceiveMoneyDialog, setShowReceiveMoneyDialog] = useState(false);
  const [sellerBankAccount, setSellerBankAccount] = useState('');
  const [sellerBankName, setSellerBankName] = useState('');

  // Buyer confirm transaction dialog (after clicking confirm button)
  const [showConfirmDurationDialog, setShowConfirmDurationDialog] = useState(false);
  const [refundBankName, setRefundBankName] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const postImageInputRef = useRef<HTMLInputElement>(null);
  const messageImageInputRef = useRef<HTMLInputElement>(null);

  // Fetch admin payment settings
  useEffect(() => {
    const fetchAdminSettings = async () => {
      const { data } = await supabase
        .from('admin_payment_box_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setAdminPaymentSettings(data as AdminPaymentBoxSettings);
      }
    };
    fetchAdminSettings();
  }, []);

  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollToBottom(distanceFromBottom > 50);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottom(false);
  }, []);

  const handleReport = async () => {
    if (!user || !selectedConversation || !reportReason) return;

    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_user_id: selectedConversation,
        reason: reportReason,
        description: reportDescription || null,
      });

      if (error) throw error;

      toast({
        title: 'Đã gửi báo cáo',
        description: 'Cảm ơn bạn đã báo cáo. Admin sẽ xem xét.',
      });

      setShowReportDialog(false);
      setReportReason('');
      setReportDescription('');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi báo cáo. Vui lòng thử lại.',
        variant: 'destructive',
      });
    }
  };

  // Delete own post
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Bạn có chắc muốn xóa bài viết này?')) return;

    try {
      const { error } = await supabase
        .from('transaction_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
      toast({ title: 'Đã xóa bài viết' });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({ title: 'Lỗi', description: 'Không thể xóa bài viết', variant: 'destructive' });
    }
  };

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('transaction_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const postsWithProfiles = data.map(post => ({
          ...post,
          profiles: profileMap.get(post.user_id)
        }));

        let result = postsWithProfiles;
        if (postFilter === 'random') {
          result = [...postsWithProfiles].sort(() => Math.random() - 0.5).slice(0, 50);
        } else if (postFilter === 'newest') {
          result = postsWithProfiles.slice(0, 50);
        }
        setPosts(result as TradingPost[]);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching trading posts:', error);
    }
  }, [postFilter]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      const { data: messagesData, error } = await supabase
        .from('transaction_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const conversationMap = new Map<string, TradingMessage[]>();
      messagesData?.forEach((msg) => {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, []);
        }
        conversationMap.get(partnerId)!.push(msg);
      });

      const partnerIds = [...conversationMap.keys()];
      if (partnerIds.length === 0) {
        setConversations([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', partnerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const convos: TradingConversation[] = partnerIds
        .map(partnerId => {
          const partnerMessages = conversationMap.get(partnerId) || [];
          const lastMessage = partnerMessages[0] || null;
          const unreadCount = partnerMessages.filter(m => m.receiver_id === user.id && !m.is_read).length;
          const participant = profileMap.get(partnerId);

          if (!participant) return null;

          return {
            id: partnerId,
            participant,
            lastMessage,
            unreadCount
          };
        })
        .filter(Boolean) as TradingConversation[];

      convos.sort((a, b) => {
        const aTime = a.lastMessage?.created_at || '';
        const bTime = b.lastMessage?.created_at || '';
        return bTime.localeCompare(aTime);
      });

      setConversations(convos);
    } catch (error) {
      console.error('Error fetching trading conversations:', error);
    }
  }, [user]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async () => {
    if (!user || !selectedConversation) return;

    try {
      const { data, error } = await supabase
        .from('transaction_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedConversation}),and(sender_id.eq.${selectedConversation},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const { error: updateError } = await supabase
        .from('transaction_messages')
        .update({ is_read: true })
        .eq('sender_id', selectedConversation)
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (!updateError) {
        setConversations(prev => prev.map(c => 
          c.id === selectedConversation 
            ? { ...c, unreadCount: 0 }
            : c
        ));
      }

      setMessages(data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      console.error('Error fetching trading messages:', error);
    }
  }, [user, selectedConversation]);

  // Search users
  const searchUsers = useCallback(async () => {
    if (!searchQuery.trim() || !user) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const query = searchQuery.trim().toUpperCase();
      
      const { data, error } = await supabase
        .from('public_profiles')
        .select('id, username, display_name, avatar_url, user_id_code, is_banned')
        .or(`user_id_code.ilike.%${query}%,username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .neq('id', user.id)
        .limit(10);

      if (error) throw error;
      
      const filteredResults = (data || []).filter(u => !u.is_banned);
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, user]);

  useEffect(() => {
    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchUsers]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, fetchConversations]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('trading-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_messages'
        },
        (payload) => {
          const newMsg = payload.new as TradingMessage;
          if (newMsg.sender_id === user.id || newMsg.receiver_id === user.id) {
            fetchConversations();
            if (selectedConversation && 
                (newMsg.sender_id === selectedConversation || newMsg.receiver_id === selectedConversation)) {
              if (newMsg.sender_id !== user.id) {
                setMessages(prev => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transaction_messages'
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations, selectedConversation]);

  // Handle post image
  const handlePostImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPostImage(file);
      setPostImagePreview(URL.createObjectURL(file));
    }
  };

  // Handle message image
  const handleMessageImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMessageImage(file);
      setMessageImagePreview(URL.createObjectURL(file));
    }
  };

  // Create post
  const handleCreatePost = async () => {
    if (!user || (!postContent.trim() && !postImage)) return;

    setIsPostLoading(true);
    try {
      let imageUrl = null;

      if (postImage) {
        const fileExt = postImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, postImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const { error } = await supabase
        .from('transaction_posts')
        .insert({
          user_id: user.id,
          content: postContent.trim() || null,
          image_url: imageUrl
        });

      if (error) throw error;

      setPostContent('');
      setPostImage(null);
      setPostImagePreview(null);
      fetchPosts();

      toast({
        title: 'Thành công',
        description: 'Đã đăng bài viết giao dịch!'
      });
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể đăng bài viết',
        variant: 'destructive'
      });
    } finally {
      setIsPostLoading(false);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!user || !selectedConversation || (!messageContent.trim() && !messageImage)) return;

    try {
      let imageUrl = null;

      if (messageImage) {
        const fileExt = messageImage.name.split('.').pop();
        const fileName = `trading/${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, messageImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const { error } = await supabase
        .from('transaction_messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedConversation,
          content: messageContent.trim() || null,
          image_url: imageUrl
        });

      if (error) throw error;

      setMessageContent('');
      setMessageImage(null);
      setMessageImagePreview(null);
      fetchMessages();
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi tin nhắn',
        variant: 'destructive'
      });
    }
  };

  // Start conversation with user
  const startConversation = async (userId: string) => {
    if (!user) return;
    
    const existingConvo = conversations.find(c => c.id === userId);
    
    if (existingConvo) {
      setSelectedConversation(userId);
      setShowConversationList(false);
    } else {
      try {
        const { data: profileData, error } = await supabase
          .from('public_profiles')
          .select('id, username, display_name, avatar_url')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;
        
        if (profileData) {
          const newConvo: TradingConversation = {
            id: userId,
            participant: {
              id: profileData.id || '',
              username: profileData.username || '',
              display_name: profileData.display_name,
              avatar_url: profileData.avatar_url
            },
            lastMessage: null,
            unreadCount: 0
          };
          setConversations(prev => [newConvo, ...prev]);
          setSelectedConversation(userId);
          setShowConversationList(false);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    }
    
    setSearchQuery('');
    setSearchResults([]);
    setIsChatOpen(true);
  };

  const handleSelectConversation = (convoId: string) => {
    setSelectedConversation(convoId);
    setShowConversationList(false);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    setShowConversationList(true);
  };

  // Payment box functions
  const handleSendPaymentBox = async () => {
    if (!user || !selectedConversation) return;

    try {
      const { data, error } = await supabase
        .from('payment_boxes')
        .insert({
          sender_id: user.id,
          receiver_id: selectedConversation,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setPaymentBoxes(prev => [...prev, data as PaymentBox]);
      }

      toast({
        title: 'Đã gửi yêu cầu giao dịch',
        description: 'Đang chờ người mua xác nhận.'
      });
      setShowPaymentBoxDialog(false);
    } catch (error) {
      console.error('Error sending payment box:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi yêu cầu giao dịch',
        variant: 'destructive'
      });
    }
  };

  // Buyer confirms to start transaction (selects duration)
  const handleBuyerConfirmStart = async (paymentBoxId: string) => {
    setSelectedPaymentBoxId(paymentBoxId);
    setShowConfirmDurationDialog(true);
  };

  // After selecting duration, show payment box
  const handleConfirmDuration = async () => {
    if (!selectedPaymentBoxId || !paymentDuration) return;

    try {
      let durationDays: number;
      switch (paymentDuration) {
        case '24h': durationDays = 1; break;
        case '3days': durationDays = 3; break;
        case '7days': durationDays = 7; break;
        case '1month': durationDays = 30; break;
        case 'custom': durationDays = parseInt(customDays) || 7; break;
        default: durationDays = 7;
      }
      
      const { error } = await supabase
        .from('payment_boxes')
        .update({ 
          payment_duration: paymentDuration,
          payment_duration_days: durationDays,
          confirmed_at: new Date().toISOString()
        })
        .eq('id', selectedPaymentBoxId);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === selectedPaymentBoxId 
          ? { ...box, payment_duration: paymentDuration, payment_duration_days: durationDays, confirmed_at: new Date().toISOString() } 
          : box
      ));

      toast({
        title: 'Đã xác nhận thời gian giao dịch',
        description: 'Vui lòng thanh toán theo hướng dẫn.'
      });
      
      setShowConfirmDurationDialog(false);
      setPaymentDuration('');
      setCustomDays('');
      // Note: selectedPaymentBoxId is kept to show payment actions
    } catch (error) {
      console.error('Error confirming duration:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xác nhận thời gian giao dịch',
        variant: 'destructive'
      });
    }
  };

  // Buyer clicks "Đã thanh toán"
  const handleBuyerPaid = async (paymentBoxId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('payment_boxes')
        .update({ 
          status: 'buyer_paid'
        })
        .eq('id', paymentBoxId);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === paymentBoxId 
          ? { ...box, status: 'buyer_paid' as PaymentBoxStatus } 
          : box
      ));

      toast({
        title: 'Đã gửi thông tin thanh toán',
        description: 'Đang chờ Admin xác nhận.'
      });
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xác nhận thanh toán',
        variant: 'destructive'
      });
    }
  };

  const handleConfirmPayment = async () => {
    // This is now handled by handleConfirmDuration
    await handleConfirmDuration();
  };

  // Buyer rejects
  const handleRejectPaymentBox = async (paymentBoxId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('payment_boxes')
        .update({ status: 'rejected' })
        .eq('id', paymentBoxId);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === paymentBoxId ? { ...box, status: 'rejected' as PaymentBoxStatus } : box
      ));

      toast({
        title: 'Đã từ chối giao dịch',
        description: 'Giao dịch đã bị hủy.'
      });
    } catch (error) {
      console.error('Error rejecting payment box:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể từ chối giao dịch',
        variant: 'destructive'
      });
    }
  };

  // Buyer requests refund (after admin confirmed)
  const handleBuyerRefundRequest = async () => {
    if (!selectedPaymentBoxId || !refundReason.trim()) return;

    try {
      const { error } = await supabase
        .from('payment_boxes')
        .update({ 
          status: 'refund_requested',
          refund_requested_at: new Date().toISOString(),
          refund_reason: refundReason,
          buyer_bank_account: refundBankAccount || null,
          buyer_bank_name: refundBankName || null
        })
        .eq('id', selectedPaymentBoxId);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === selectedPaymentBoxId 
          ? { ...box, status: 'refund_requested' as PaymentBoxStatus, refund_requested_at: new Date().toISOString() } 
          : box
      ));

      toast({
        title: 'Đã gửi yêu cầu hoàn tiền',
        description: 'Đang chờ Admin xác nhận.'
      });
      
      setShowRefundDialog(false);
      setSelectedPaymentBoxId(null);
      setRefundReason('');
      setRefundBankAccount('');
      setRefundBankName('');
    } catch (error) {
      console.error('Error requesting refund:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi yêu cầu hoàn tiền',
        variant: 'destructive'
      });
    }
  };

  // Seller completes transaction
  const handleSellerComplete = async (paymentBoxId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('payment_boxes')
        .update({ 
          seller_completed_at: new Date().toISOString()
        })
        .eq('id', paymentBoxId);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === paymentBoxId 
          ? { ...box, seller_completed_at: new Date().toISOString() } 
          : box
      ));

      toast({
        title: 'Đã hoàn thành bàn giao',
        description: 'Đang chờ người mua xác nhận.'
      });
    } catch (error) {
      console.error('Error completing transaction:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể hoàn thành giao dịch',
        variant: 'destructive'
      });
    }
  };

  // Buyer confirms transaction success
  const handleBuyerConfirmSuccess = async (paymentBoxId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('payment_boxes')
        .update({ 
          buyer_confirmed_at: new Date().toISOString()
        })
        .eq('id', paymentBoxId);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === paymentBoxId 
          ? { ...box, buyer_confirmed_at: new Date().toISOString() } 
          : box
      ));

      toast({
        title: 'Đã xác nhận nhận hàng',
        description: 'Người bán có thể nhận tiền.'
      });
    } catch (error) {
      console.error('Error confirming transaction:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xác nhận giao dịch',
        variant: 'destructive'
      });
    }
  };

  // Seller requests to receive money
  const handleSellerReceiveMoney = async () => {
    if (!selectedPaymentBoxId || !sellerBankAccount.trim() || !sellerBankName.trim()) return;

    try {
      const { error } = await supabase
        .from('payment_boxes')
        .update({ 
          seller_bank_account: sellerBankAccount,
          seller_bank_name: sellerBankName,
          seller_confirmed_at: new Date().toISOString()
        })
        .eq('id', selectedPaymentBoxId);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === selectedPaymentBoxId 
          ? { ...box, seller_bank_account: sellerBankAccount, seller_bank_name: sellerBankName, seller_confirmed_at: new Date().toISOString() } 
          : box
      ));

      toast({
        title: 'Đã gửi yêu cầu nhận tiền',
        description: 'Đang chờ Admin xác nhận để hoàn tất giao dịch.'
      });
      
      setShowReceiveMoneyDialog(false);
      setSelectedPaymentBoxId(null);
      setSellerBankAccount('');
      setSellerBankName('');
    } catch (error) {
      console.error('Error requesting receive money:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi yêu cầu nhận tiền',
        variant: 'destructive'
      });
    }
  };

  // Sender cancels pending request
  const handleCancelPaymentBox = async (paymentBoxId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('payment_boxes')
        .update({ status: 'cancelled' })
        .eq('id', paymentBoxId)
        .eq('sender_id', user.id);

      if (error) throw error;

      setPaymentBoxes(prev => prev.map(box => 
        box.id === paymentBoxId ? { ...box, status: 'cancelled' as PaymentBoxStatus } : box
      ));

      toast({
        title: 'Đã hủy yêu cầu',
        description: 'Bạn đã hủy yêu cầu giao dịch.'
      });
    } catch (error) {
      console.error('Error cancelling payment box:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể hủy yêu cầu giao dịch',
        variant: 'destructive'
      });
    }
  };

  // Fetch payment boxes for current conversation
  useEffect(() => {
    if (!user || !selectedConversation) {
      setPaymentBoxes([]);
      return;
    }

    const fetchPaymentBoxes = async () => {
      const { data } = await supabase
        .from('payment_boxes')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedConversation}),and(sender_id.eq.${selectedConversation},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (data) {
        setPaymentBoxes(data as PaymentBox[]);
      }
    };

    fetchPaymentBoxes();

    const channel = supabase
      .channel('payment-boxes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_boxes'
        },
        (payload) => {
          const box = payload.new as PaymentBox;
          if (payload.eventType === 'INSERT') {
            if ((box.sender_id === user.id && box.receiver_id === selectedConversation) ||
                (box.sender_id === selectedConversation && box.receiver_id === user.id)) {
              setPaymentBoxes(prev => {
                if (prev.some(p => p.id === box.id)) return prev;
                return [...prev, box];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            setPaymentBoxes(prev => prev.map(p => p.id === box.id ? box : p));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedConversation]);

  // Calculate remaining transaction days
  const getRemainingDays = (box: PaymentBox): number | null => {
    if (!box.transaction_start_at || !box.payment_duration_days) return null;
    const endDate = addDays(new Date(box.transaction_start_at), box.payment_duration_days);
    const remaining = differenceInDays(endDate, new Date());
    return Math.max(0, remaining);
  };

  const isTransactionExpired = (box: PaymentBox): boolean => {
    const remaining = getRemainingDays(box);
    return remaining !== null && remaining <= 0;
  };

  // Render payment box in chat
  const renderPaymentBox = (box: PaymentBox) => {
    const isSender = box.sender_id === user?.id; // Sender = Seller
    const isReceiver = box.receiver_id === user?.id; // Receiver = Buyer
    const remainingDays = getRemainingDays(box);
    const expired = isTransactionExpired(box);
    const hasDurationSelected = !!box.confirmed_at && !!box.payment_duration_days;

    const getStatusMessage = () => {
      if (box.status === 'completed') {
        return '✅ Người bán đã nhận được tiền - Hoàn tất giao dịch!';
      }
      if (box.seller_confirmed_at && !box.status.includes('completed')) {
        return '💰 Người bán đã yêu cầu nhận tiền - Đang chờ Admin xác nhận';
      }
      if (box.buyer_confirmed_at && !box.seller_confirmed_at) {
        return '✅ Người mua đã xác nhận nhận hàng';
      }
      if (box.seller_completed_at && !box.buyer_confirmed_at) {
        return '📦 Người bán đã bàn giao thành công - Giao dịch hoàn tất vui lòng xác nhận';
      }
      switch (box.status) {
        case 'pending':
          if (hasDurationSelected && !box.status.includes('buyer_paid')) {
            return '📋 Đã chọn thời gian giao dịch - Vui lòng thanh toán';
          }
          return isSender 
            ? 'Bạn đã gửi yêu cầu giao dịch. Đang chờ người mua xác nhận.' 
            : 'Người bán muốn bắt đầu giao dịch với bạn.';
        case 'buyer_paid':
          return '💳 Người mua đã thanh toán - Đang chờ Admin xác nhận';
        case 'admin_confirmed':
          return '✅ Bắt đầu giao dịch';
        case 'cancelled':
          return 'Giao dịch đã bị hủy.';
        case 'refund_requested':
          return isReceiver
            ? '🔄 Bạn đã yêu cầu hoàn tiền. Đang chờ Admin duyệt.'
            : '🔄 Người mua đã yêu cầu hoàn tiền. Đang chờ Admin duyệt.';
        case 'refunded':
          return '💰 Đã hoàn tiền giao dịch';
        case 'rejected':
          return 'Giao dịch đã bị từ chối.';
        default:
          return '';
      }
    };

    const getBorderColor = () => {
      if (box.status === 'completed') return 'border-green-500 bg-green-500/10';
      if (box.seller_confirmed_at) return 'border-purple-500 bg-purple-500/10';
      if (box.buyer_confirmed_at || box.seller_completed_at) return 'border-blue-500 bg-blue-500/10';
      switch (box.status) {
        case 'admin_confirmed':
          return 'border-green-500 bg-green-500/10';
        case 'rejected':
        case 'cancelled':
          return 'border-destructive bg-destructive/10';
        case 'refund_requested':
          return 'border-orange-500 bg-orange-500/10';
        case 'refunded':
          return 'border-blue-500 bg-blue-500/10';
        case 'buyer_paid':
          return 'border-yellow-500 bg-yellow-500/10';
        default:
          return 'border-warning bg-warning/10';
      }
    };

    return (
      <div key={box.id} className="flex justify-center my-3">
        <div className={`w-full max-w-[90%] rounded-lg p-4 border-2 ${getBorderColor()}`}>
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5" />
            <span className="font-medium">Hộp thanh toán</span>
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            {getStatusMessage()}
          </p>

          {/* Show remaining time for active transactions */}
          {box.status === 'admin_confirmed' && remainingDays !== null && !box.seller_completed_at && (
            <div className="flex items-center gap-2 text-sm mb-3 p-2 rounded bg-secondary/50">
              <Timer className="w-4 h-4" />
              <span>Thời gian giao dịch còn lại: <strong>{remainingDays} ngày</strong></span>
            </div>
          )}

          {/* Show remaining time after seller completed */}
          {box.seller_completed_at && !box.buyer_confirmed_at && remainingDays !== null && !expired && (
            <div className="flex items-center gap-2 text-sm mb-3 p-2 rounded bg-secondary/50">
              <Timer className="w-4 h-4" />
              <span>Còn {remainingDays} ngày để xác nhận nhận hàng</span>
            </div>
          )}

          {/* Pending: Buyer sees confirm/reject buttons */}
          {box.status === 'pending' && isReceiver && !hasDurationSelected && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleBuyerConfirmStart(box.id)}
                className="gap-1"
              >
                <Check className="w-4 h-4" />
                Xác nhận
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRejectPaymentBox(box.id)}
                className="gap-1"
              >
                <XCircle className="w-4 h-4" />
                Từ chối
              </Button>
            </div>
          )}

          {/* After duration selected: Show payment box + pay/cancel buttons */}
          {box.status === 'pending' && isReceiver && hasDurationSelected && (
            <div className="space-y-3">
              {/* Show admin payment box */}
              {adminPaymentSettings && (
                <div className="bg-background/50 rounded-lg p-3 space-y-2">
                  {adminPaymentSettings.image_url && (
                    <img 
                      src={adminPaymentSettings.image_url} 
                      alt="Payment info" 
                      className="max-w-full rounded cursor-pointer"
                      onClick={() => setLightboxImage(adminPaymentSettings.image_url)}
                    />
                  )}
                  {adminPaymentSettings.content && (
                    <p className="text-sm whitespace-pre-wrap">{adminPaymentSettings.content}</p>
                  )}
                  {adminPaymentSettings.has_fee && adminPaymentSettings.transaction_fee && (
                    <p className="text-sm text-muted-foreground">
                      Phí giao dịch: {adminPaymentSettings.transaction_fee}
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleBuyerPaid(box.id)}
                  className="gap-1"
                >
                  <Check className="w-4 h-4" />
                  Đã thanh toán
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRejectPaymentBox(box.id)}
                  className="gap-1"
                >
                  <XCircle className="w-4 h-4" />
                  Hủy
                </Button>
              </div>
            </div>
          )}

          {/* Pending: Seller can cancel */}
          {box.status === 'pending' && isSender && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCancelPaymentBox(box.id)}
              className="gap-1"
            >
              <XCircle className="w-4 h-4" />
              Hủy yêu cầu
            </Button>
          )}

          {/* Admin confirmed: Active transaction */}
          {box.status === 'admin_confirmed' && !box.seller_completed_at && (
            <div className="space-y-2">
              {/* Seller sees: Complete button or Cancel */}
              {isSender && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleSellerComplete(box.id)}
                    className="gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Đã bàn giao
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancelPaymentBox(box.id)}
                    className="gap-1"
                  >
                    <XCircle className="w-4 h-4" />
                    Hủy
                  </Button>
                </div>
              )}
              
              {/* Buyer sees: Waiting status + Refund/Cancel option */}
              {isReceiver && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Chờ người bán hoàn thành
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedPaymentBoxId(box.id);
                        setShowRefundDialog(true);
                      }}
                      className="gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Hoàn tiền
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelPaymentBox(box.id)}
                      className="gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      Hủy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Seller completed: Waiting for buyer confirmation */}
          {box.seller_completed_at && !box.buyer_confirmed_at && box.status !== 'refund_requested' && box.status !== 'refunded' && (
            <div className="space-y-2">
              {isReceiver && (
                <>
                  {expired ? (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleBuyerConfirmSuccess(box.id)}
                      className="gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Xác nhận nhận hàng
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Timer className="w-4 h-4" />
                      Vui lòng xác nhận khi đã nhận hàng (hoặc đợi hết thời gian)
                    </p>
                  )}
                </>
              )}
              {isSender && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Đang chờ người mua xác nhận nhận hàng
                </p>
              )}
            </div>
          )}

          {/* Buyer confirmed: Seller can request money */}
          {box.buyer_confirmed_at && !box.seller_confirmed_at && box.status !== 'completed' && (
            <div className="space-y-2">
              {isSender && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setSelectedPaymentBoxId(box.id);
                    setShowReceiveMoneyDialog(true);
                  }}
                  className="gap-1"
                >
                  <CreditCard className="w-4 h-4" />
                  Nhận tiền
                </Button>
              )}
              {isReceiver && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Đang chờ người bán yêu cầu nhận tiền
                </p>
              )}
            </div>
          )}

          {/* Seller requested money: Waiting for admin */}
          {box.seller_confirmed_at && box.status !== 'completed' && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Đang chờ Admin xác nhận để hoàn tất giao dịch
            </p>
          )}

          <p className="text-[10px] text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(box.created_at), { addSuffix: true, locale: vi })}
          </p>
        </div>
      </div>
    );
  };

  const selectedPartner = conversations.find(c => c.id === selectedConversation)?.participant ||
    searchResults.find(r => r.id === selectedConversation);

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Giao dịch</h1>
            <p className="text-muted-foreground text-sm">Đăng bài và nhắn tin giao dịch</p>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Posts Section */}
          <div className="flex-1 space-y-4">
            <Card className="glass">
              <CardHeader className="pb-3">
                <h2 className="font-semibold">Đăng bài giao dịch</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Nội dung giao dịch..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="min-h-[100px] resize-none"
                />

                {postImagePreview && (
                  <div className="relative inline-block">
                    <img
                      src={postImagePreview}
                      alt="Preview"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 w-6 h-6"
                      onClick={() => {
                        setPostImage(null);
                        setPostImagePreview(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => postImageInputRef.current?.click()}
                  >
                    <ImagePlus className="w-5 h-5 mr-2" />
                    Thêm ảnh
                  </Button>
                  <input
                    ref={postImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePostImageSelect}
                  />
                  <Button
                    onClick={handleCreatePost}
                    disabled={isPostLoading || (!postContent.trim() && !postImage)}
                  >
                    {isPostLoading ? 'Đang đăng...' : 'Đăng bài'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Filter */}
            <div className="flex gap-2">
              <Button
                variant={postFilter === 'newest' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPostFilter('newest')}
              >
                <Clock className="w-4 h-4 mr-1" />
                Mới nhất
              </Button>
              <Button
                variant={postFilter === 'random' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPostFilter('random')}
              >
                <Shuffle className="w-4 h-4 mr-1" />
                Ngẫu nhiên
              </Button>
              <Button
                variant={postFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPostFilter('all')}
              >
                <List className="w-4 h-4 mr-1" />
                Tất cả
              </Button>
            </div>

            {/* Posts List */}
            <div className="space-y-4">
              {posts.map((post) => (
                <Card key={post.id} className="glass">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Link to={`/profile/${post.user_id}`}>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={post.profiles?.avatar_url || ''} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {(post.profiles?.display_name || post.profiles?.username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/profile/${post.user_id}`}
                              className="font-semibold hover:underline"
                            >
                              {post.profiles?.display_name || post.profiles?.username || 'Người dùng'}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(post.created_at), {
                                addSuffix: true,
                                locale: vi
                              })}
                            </span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass">
                              {user?.id === post.user_id ? (
                                <DropdownMenuItem
                                  onClick={() => handleDeletePost(post.id)}
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Xóa bài viết
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setShowReportDialog(true)}
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                >
                                  <Flag className="w-4 h-4 mr-2" />
                                  Báo cáo bài viết
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {post.content && (
                          <p className="mt-2 text-sm whitespace-pre-wrap">{post.content}</p>
                        )}
                        {post.image_url && (
                          <img
                            src={post.image_url}
                            alt="Post"
                            className="mt-3 rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setLightboxImage(post.image_url)}
                          />
                        )}
                        {user?.id !== post.user_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => startConversation(post.user_id)}
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Nhắn tin
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {posts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground glass rounded-xl">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Chưa có bài viết giao dịch nào</p>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Chat Section - Desktop */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-24">
              <Card className="glass h-[calc(100vh-8rem)] flex flex-col">
                <CardHeader className="pb-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    {showConversationList ? (
                      <>
                        <h2 className="font-semibold flex items-center gap-2">
                          <MessageCircle className="w-5 h-5" />
                          Tin nhắn giao dịch
                          {totalUnreadMessages > 0 && (
                            <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                              {totalUnreadMessages}
                            </span>
                          )}
                        </h2>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={handleBackToList}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={selectedPartner?.avatar_url || ''} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {(selectedPartner?.display_name || selectedPartner?.username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <Link
                          to={`/profile/${selectedConversation}`}
                          className="font-medium text-sm hover:underline truncate flex-1"
                        >
                          {selectedPartner?.display_name || selectedPartner?.username || 'Người dùng'}
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="glass">
                            <DropdownMenuItem
                              onClick={() => setShowReportDialog(true)}
                              className="text-destructive focus:text-destructive cursor-pointer"
                            >
                              <Flag className="w-4 h-4 mr-2" />
                              Báo cáo người dùng
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                  {showConversationList && (
                    <p className="text-xs text-muted-foreground">Tin nhắn được lưu vĩnh viễn</p>
                  )}
                </CardHeader>

                <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                  {showConversationList ? (
                    <div className="flex flex-col h-full">
                      <div className="px-4 pb-3 relative">
                        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Tìm ID, tên người dùng..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                        {searchResults.length > 0 && (
                          <Card className="absolute left-4 right-4 mt-1 z-50 glass">
                            <CardContent className="p-2">
                              {searchResults.map((result) => (
                                <div
                                  key={result.id}
                                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer"
                                  onClick={() => startConversation(result.id)}
                                >
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={result.avatar_url || ''} />
                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                      {(result.display_name || result.username).charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm font-medium">
                                      {result.display_name || result.username}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      ID: {result.user_id_code}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}
                      </div>

                      <ScrollArea className="flex-1 px-2">
                        <div className="space-y-1">
                          {conversations.map((convo) => (
                            <div
                              key={convo.id}
                              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                selectedConversation === convo.id
                                  ? 'bg-primary/10'
                                  : 'hover:bg-secondary'
                              }`}
                              onClick={() => handleSelectConversation(convo.id)}
                            >
                              <Avatar className="h-10 w-10 flex-shrink-0">
                                <AvatarImage src={convo.participant.avatar_url || ''} />
                                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                                  {(convo.participant.display_name || convo.participant.username).charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {convo.participant.display_name || convo.participant.username}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {convo.lastMessage?.content || 'Hình ảnh'}
                                </p>
                              </div>
                              {convo.unreadCount > 0 && (
                                <span className="flex items-center justify-center min-w-[20px] h-5 text-xs bg-destructive text-destructive-foreground rounded-full px-1">
                                  {convo.unreadCount}
                                </span>
                              )}
                            </div>
                          ))}

                          {conversations.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              Chưa có cuộc trò chuyện
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full relative">
                      <ScrollArea className="flex-1 px-4" onScrollCapture={handleMessagesScroll}>
                        <div className="space-y-2 py-2">
                          {(() => {
                            const allItems = [
                              ...messages.map(m => ({ type: 'message' as const, data: m, time: new Date(m.created_at).getTime() })),
                              ...paymentBoxes.map(p => ({ type: 'paymentBox' as const, data: p, time: new Date(p.created_at).getTime() }))
                            ].sort((a, b) => a.time - b.time);

                            return allItems.map((item) => {
                              if (item.type === 'paymentBox') {
                                return renderPaymentBox(item.data as PaymentBox);
                              }
                              const msg = item.data as TradingMessage;
                              return (
                                <div
                                  key={msg.id}
                                  className={`flex ${
                                    msg.sender_id === user?.id ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  <div
                                    className={`max-w-[80%] rounded-lg p-2 ${
                                      msg.sender_id === user?.id
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-secondary'
                                    }`}
                                  >
                                    {msg.content && (
                                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                    {msg.image_url && (
                                      <img
                                        src={msg.image_url}
                                        alt="Message"
                                        className="max-w-full rounded mt-1 cursor-pointer"
                                        onClick={() => setLightboxImage(msg.image_url)}
                                      />
                                    )}
                                    <p className={`text-[10px] mt-1 ${
                                      msg.sender_id === user?.id
                                        ? 'text-primary-foreground/70'
                                        : 'text-muted-foreground'
                                    }`}>
                                      {formatDistanceToNow(new Date(msg.created_at), {
                                        addSuffix: true,
                                        locale: vi
                                      })}
                                    </p>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                          {messages.length === 0 && paymentBoxes.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              Bắt đầu cuộc trò chuyện
                            </p>
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>
                      
                      {showScrollToBottom && (
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute bottom-24 right-4 rounded-full shadow-lg z-10 h-8 w-8"
                          onClick={scrollToBottom}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      )}

                      <div className="p-3 border-t">
                        {messageImagePreview && (
                          <div className="relative inline-block mb-2">
                            <img
                              src={messageImagePreview}
                              alt="Preview"
                              className="w-12 h-12 object-cover rounded"
                            />
                            <Button
                              size="icon"
                              variant="destructive"
                              className="absolute -top-2 -right-2 w-5 h-5"
                              onClick={() => {
                                setMessageImage(null);
                                setMessageImagePreview(null);
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            ref={messageImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleMessageImageSelect}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="glass">
                              <DropdownMenuItem
                                onClick={() => messageImageInputRef.current?.click()}
                                className="cursor-pointer"
                              >
                                <ImageIcon className="w-4 h-4 mr-2" />
                                Tải ảnh lên
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setShowPaymentBoxDialog(true)}
                                className="cursor-pointer"
                              >
                                <CreditCard className="w-4 h-4 mr-2" />
                                Hộp thanh toán
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Input
                            placeholder="Nhập tin nhắn..."
                            value={messageContent}
                            onChange={(e) => setMessageContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            className="flex-1 h-9"
                          />
                          <Button
                            size="icon"
                            className="h-9 w-9"
                            onClick={handleSendMessage}
                            disabled={!messageContent.trim() && !messageImage}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Floating Chat Button - Mobile */}
        <Button
          className="lg:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg gradient-primary"
          onClick={() => setIsChatOpen(true)}
        >
          <MessageCircle className="w-6 h-6" />
          {totalUnreadMessages > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
              {totalUnreadMessages > 9 ? '9+' : totalUnreadMessages}
            </span>
          )}
        </Button>

        {/* Full Screen Chat - Mobile */}
        {isChatOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background flex flex-col">
            <div className="glass border-b p-4 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (selectedConversation && !showConversationList) {
                    setSelectedConversation(null);
                    setShowConversationList(true);
                  } else {
                    setIsChatOpen(false);
                  }
                }}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              {selectedConversation && !showConversationList && selectedPartner ? (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedPartner.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {(selectedPartner.display_name || selectedPartner.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold truncate flex-1">
                      {selectedPartner.display_name || selectedPartner.username}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass">
                      <DropdownMenuItem
                        onClick={() => setShowReportDialog(true)}
                        className="text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        Báo cáo người dùng
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <h2 className="font-semibold">Tin nhắn giao dịch</h2>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              {selectedConversation && !showConversationList ? (
                <div className="flex flex-col h-full relative">
                  <ScrollArea className="flex-1 p-4" onScrollCapture={handleMessagesScroll}>
                    <div className="space-y-3">
                      {(() => {
                        const allItems = [
                          ...messages.map(m => ({ type: 'message' as const, data: m, time: new Date(m.created_at).getTime() })),
                          ...paymentBoxes.map(p => ({ type: 'paymentBox' as const, data: p, time: new Date(p.created_at).getTime() }))
                        ].sort((a, b) => a.time - b.time);

                        return allItems.map((item) => {
                          if (item.type === 'paymentBox') {
                            return renderPaymentBox(item.data as PaymentBox);
                          }
                          const msg = item.data as TradingMessage;
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${
                                msg.sender_id === user?.id ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg p-3 ${
                                  msg.sender_id === user?.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary'
                                }`}
                              >
                                {msg.content && (
                                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                )}
                                {msg.image_url && (
                                  <img
                                    src={msg.image_url}
                                    alt="Message"
                                    className="max-w-full rounded mt-1 cursor-pointer"
                                    onClick={() => setLightboxImage(msg.image_url)}
                                  />
                                )}
                                <p className={`text-[10px] mt-1 ${
                                  msg.sender_id === user?.id
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground'
                                }`}>
                                  {formatDistanceToNow(new Date(msg.created_at), {
                                    addSuffix: true,
                                    locale: vi
                                  })}
                                </p>
                              </div>
                            </div>
                          );
                        });
                      })()}
                      {messages.length === 0 && paymentBoxes.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Bắt đầu cuộc trò chuyện
                        </p>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  {showScrollToBottom && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-24 right-4 rounded-full shadow-lg z-10 h-10 w-10"
                      onClick={scrollToBottom}
                    >
                      <ArrowDown className="w-5 h-5" />
                    </Button>
                  )}

                  <div className="p-4 border-t glass">
                    {messageImagePreview && (
                      <div className="relative inline-block mb-2">
                        <img
                          src={messageImagePreview}
                          alt="Preview"
                          className="w-16 h-16 object-cover rounded"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 w-5 h-5"
                          onClick={() => {
                            setMessageImage(null);
                            setMessageImagePreview(null);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="glass">
                          <DropdownMenuItem
                            onClick={() => messageImageInputRef.current?.click()}
                            className="cursor-pointer"
                          >
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Tải ảnh lên
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setShowPaymentBoxDialog(true)}
                            className="cursor-pointer"
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            Hộp thanh toán
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Input
                        placeholder="Nhập tin nhắn..."
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={!messageContent.trim() && !messageImage}
                      >
                        <Send className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Tìm ID, tên người dùng..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Kết quả tìm kiếm</h3>
                      {searchResults.map((result) => (
                        <div
                          key={result.id}
                          className="flex items-center gap-3 p-3 rounded-xl glass cursor-pointer"
                          onClick={() => {
                            startConversation(result.id);
                            setShowConversationList(false);
                          }}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={result.avatar_url || ''} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {(result.display_name || result.username).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {result.display_name || result.username}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ID: {result.user_id_code}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Cuộc trò chuyện</h3>
                    {conversations.map((convo) => (
                      <div
                        key={convo.id}
                        className="flex items-center gap-3 p-3 rounded-xl glass cursor-pointer"
                        onClick={() => {
                          setSelectedConversation(convo.id);
                          setShowConversationList(false);
                        }}
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={convo.participant.avatar_url || ''} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {(convo.participant.display_name || convo.participant.username).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {convo.participant.display_name || convo.participant.username}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {convo.lastMessage?.content || 'Hình ảnh'}
                          </p>
                        </div>
                        {convo.unreadCount > 0 && (
                          <span className="flex items-center justify-center min-w-[24px] h-6 text-sm bg-destructive text-destructive-foreground rounded-full px-2">
                            {convo.unreadCount}
                          </span>
                        )}
                      </div>
                    ))}

                    {conversations.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Chưa có cuộc trò chuyện nào</p>
                        <p className="text-sm">Tìm người dùng để bắt đầu</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage}
          alt="Enlarged image"
          isOpen={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Báo cáo người dùng</DialogTitle>
            <DialogDescription>
              Vui lòng chọn lý do báo cáo. Báo cáo sẽ được gửi đến Admin để xem xét.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lý do báo cáo</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Chọn lý do" />
                </SelectTrigger>
                <SelectContent className="glass">
                  <SelectItem value="spam">Spam / Quảng cáo</SelectItem>
                  <SelectItem value="harassment">Quấy rối / Đe dọa</SelectItem>
                  <SelectItem value="inappropriate">Nội dung không phù hợp</SelectItem>
                  <SelectItem value="fake">Tài khoản giả mạo</SelectItem>
                  <SelectItem value="scam">Lừa đảo</SelectItem>
                  <SelectItem value="other">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mô tả chi tiết (tùy chọn)</Label>
              <Textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Mô tả chi tiết về vấn đề..."
                className="rounded-xl min-h-[100px]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowReportDialog(false)}
                className="rounded-xl"
              >
                Hủy
              </Button>
              <Button
                onClick={handleReport}
                disabled={!reportReason}
                className="rounded-xl gradient-primary"
              >
                Gửi báo cáo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Box Dialog */}
      <Dialog open={showPaymentBoxDialog} onOpenChange={setShowPaymentBoxDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Gửi yêu cầu giao dịch</DialogTitle>
            <DialogDescription>
              Bạn sẽ gửi yêu cầu giao dịch đến người mua. Họ sẽ cần xác nhận thanh toán.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowPaymentBoxDialog(false)}
              className="rounded-xl"
            >
              Hủy
            </Button>
            <Button
              onClick={handleSendPaymentBox}
              className="rounded-xl gradient-primary"
            >
              Gửi yêu cầu
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Duration Dialog */}
      <Dialog open={showPaymentDurationDialog} onOpenChange={setShowPaymentDurationDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Xác nhận thanh toán</DialogTitle>
            <DialogDescription>
              Vui lòng chọn thời gian giao dịch. Thông tin sẽ được gửi đến Admin để xác nhận.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Thời gian giao dịch</Label>
              <Select value={paymentDuration} onValueChange={setPaymentDuration}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Chọn thời gian" />
                </SelectTrigger>
                <SelectContent className="glass">
                  <SelectItem value="24h">24 giờ</SelectItem>
                  <SelectItem value="3days">3 ngày</SelectItem>
                  <SelectItem value="7days">7 ngày</SelectItem>
                  <SelectItem value="1month">1 tháng</SelectItem>
                  <SelectItem value="custom">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentDuration === 'custom' && (
              <div className="space-y-2">
                <Label>Nhập số ngày</Label>
                <Input
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="Số ngày..."
                  min="1"
                  className="rounded-xl"
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPaymentDurationDialog(false);
                  setSelectedPaymentBoxId(null);
                  setPaymentDuration('');
                  setCustomDays('');
                }}
                className="rounded-xl"
              >
                Hủy
              </Button>
              <Button
                onClick={handleConfirmPayment}
                disabled={!paymentDuration || (paymentDuration === 'custom' && !customDays)}
                className="rounded-xl gradient-primary"
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Duration Dialog (buyer selects transaction time) */}
      <Dialog open={showConfirmDurationDialog} onOpenChange={setShowConfirmDurationDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Chọn thời gian giao dịch</DialogTitle>
            <DialogDescription>
              Vui lòng chọn thời gian giao dịch. Sau khi xác nhận, bạn sẽ cần thanh toán.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Thời gian giao dịch</Label>
              <Select value={paymentDuration} onValueChange={setPaymentDuration}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Chọn thời gian" />
                </SelectTrigger>
                <SelectContent className="glass">
                  <SelectItem value="24h">24 giờ</SelectItem>
                  <SelectItem value="3days">3 ngày</SelectItem>
                  <SelectItem value="7days">7 ngày</SelectItem>
                  <SelectItem value="1month">1 tháng</SelectItem>
                  <SelectItem value="custom">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentDuration === 'custom' && (
              <div className="space-y-2">
                <Label>Nhập số ngày</Label>
                <Input
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="Số ngày..."
                  min="1"
                  className="rounded-xl"
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmDurationDialog(false);
                  setSelectedPaymentBoxId(null);
                  setPaymentDuration('');
                  setCustomDays('');
                }}
                className="rounded-xl"
              >
                Hủy
              </Button>
              <Button
                onClick={handleConfirmDuration}
                disabled={!paymentDuration || (paymentDuration === 'custom' && !customDays)}
                className="rounded-xl gradient-primary"
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Yêu cầu hoàn tiền</DialogTitle>
            <DialogDescription>
              Vui lòng điền thông tin để gửi yêu cầu hoàn tiền đến Admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lý do hoàn tiền *</Label>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Nhập lý do yêu cầu hoàn tiền..."
                className="rounded-xl min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Số tài khoản ngân hàng *</Label>
              <Input
                value={refundBankAccount}
                onChange={(e) => setRefundBankAccount(e.target.value)}
                placeholder="Số tài khoản nhận hoàn tiền..."
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Tên ngân hàng *</Label>
              <Input
                value={refundBankName}
                onChange={(e) => setRefundBankName(e.target.value)}
                placeholder="VD: Vietcombank, MB Bank..."
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRefundDialog(false);
                  setSelectedPaymentBoxId(null);
                  setRefundReason('');
                  setRefundBankAccount('');
                  setRefundBankName('');
                }}
                className="rounded-xl"
              >
                Hủy
              </Button>
              <Button
                onClick={handleBuyerRefundRequest}
                disabled={!refundReason.trim() || !refundBankAccount.trim() || !refundBankName.trim()}
                className="rounded-xl gradient-primary"
              >
                Gửi yêu cầu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Seller Receive Money Dialog */}
      <Dialog open={showReceiveMoneyDialog} onOpenChange={setShowReceiveMoneyDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Nhận tiền giao dịch</DialogTitle>
            <DialogDescription>
              Vui lòng điền thông tin tài khoản để nhận tiền. Admin sẽ xác nhận và hoàn tất giao dịch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên tài khoản *</Label>
              <Input
                value={sellerBankName}
                onChange={(e) => setSellerBankName(e.target.value)}
                placeholder="Tên chủ tài khoản..."
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Số tài khoản *</Label>
              <Input
                value={sellerBankAccount}
                onChange={(e) => setSellerBankAccount(e.target.value)}
                placeholder="Số tài khoản nhận tiền..."
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReceiveMoneyDialog(false);
                  setSelectedPaymentBoxId(null);
                  setSellerBankAccount('');
                  setSellerBankName('');
                }}
                className="rounded-xl"
              >
                Hủy
              </Button>
              <Button
                onClick={handleSellerReceiveMoney}
                disabled={!sellerBankAccount.trim() || !sellerBankName.trim()}
                className="rounded-xl gradient-primary"
              >
                Xác nhận nhận tiền
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Trading;
