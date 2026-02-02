import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Message, Profile, Conversation, DeletionDisableRequest, MessageDeletionSetting } from '@/types/database';
import { Send, Image, Search, MoreVertical, Flag, ArrowLeft, MessageCircle, Smile, X, Edit, Trash2, Reply, Clock, Check, XCircle, ArrowDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const Messages = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottom(false);
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollToBottom(distanceFromBottom > 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const validMessages = messagesData || [];
      const userIds = [...new Set(validMessages.flatMap(m => [m.sender_id, m.receiver_id]))];
      
      if (userIds.length === 0) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      const { data: profilesData } = await supabase.from('public_profiles').select('*').in('id', userIds);
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

      const conversationMap = new Map<string, Conversation>();

      validMessages.forEach((msg) => {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const partnerProfile = profilesMap.get(partnerId) as Profile;

        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            id: partnerId,
            participant: partnerProfile,
            lastMessage: msg as Message,
            unreadCount: 0,
          });
        }

        if (msg.receiver_id === user.id && !msg.is_read) {
          const conv = conversationMap.get(partnerId)!;
          conv.unreadCount++;
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchMessages = useCallback(async (partnerId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const validMessages = data || [];
      
      // Fetch reply-to messages
      const replyToIds = validMessages.filter(m => m.reply_to_id).map(m => m.reply_to_id);
      let replyToMap = new Map<string, Message>();
      
      if (replyToIds.length > 0) {
        const { data: replyToData } = await supabase
          .from('messages')
          .select('*')
          .in('id', replyToIds);
        
        if (replyToData) {
          replyToMap = new Map(replyToData.map(m => [m.id, m as Message]));
        }
      }
      
      const messagesWithReplies = validMessages.map(m => ({
        ...m,
        reply_to: m.reply_to_id ? replyToMap.get(m.reply_to_id) || null : null
      })) as Message[];
      
      setMessages(messagesWithReplies);

      // Mark messages as read
      const { error: updateError } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', partnerId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (!updateError) {
        setConversations(prev => prev.map(c => 
          c.id === partnerId 
            ? { ...c, unreadCount: 0 }
            : c
        ));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Global subscription for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        async (payload) => {
          fetchConversations();
          
          const newMsg = payload.new as Message;
          if (selectedConversation && newMsg.sender_id === selectedConversation.id) {
            // If message has reply_to_id, fetch the reply_to message
            let messageWithReply = { ...newMsg, reply_to: null as Message | null };
            if (newMsg.reply_to_id) {
              const { data: replyToData } = await supabase
                .from('messages')
                .select('*')
                .eq('id', newMsg.reply_to_id)
                .maybeSingle();
              if (replyToData) {
                messageWithReply.reply_to = replyToData as Message;
              }
            }
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, messageWithReply];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
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

  useEffect(() => {
    const userId = searchParams.get('user');
    if (userId && user && !isLoading) {
      const existingConv = conversations.find((c) => c.participant?.id === userId);
      if (existingConv) {
        setSelectedConversation(existingConv);
        fetchMessages(existingConv.id);
      } else {
        const fetchUserAndCreateConversation = async () => {
          try {
            const { data: profileData, error } = await supabase
              .from('public_profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();

            if (error) throw error;
            if (profileData) {
              const newConv: Conversation = {
                id: userId,
                participant: profileData as Profile,
                lastMessage: null,
                unreadCount: 0,
              };
              setSelectedConversation(newConv);
              setMessages([]);
            }
          } catch (error) {
            console.error('Error fetching user:', error);
          }
        };
        fetchUserAndCreateConversation();
      }
    }
  }, [searchParams, user, conversations, fetchMessages, isLoading]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);

      const channel = supabase
        .channel(`messages-${selectedConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          async (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMsg = payload.new as Message;
              if (
                (newMsg.sender_id === user?.id && newMsg.receiver_id === selectedConversation.id) ||
                (newMsg.sender_id === selectedConversation.id && newMsg.receiver_id === user?.id)
              ) {
                let messageWithReply = { ...newMsg, reply_to: null as Message | null };
                if (newMsg.reply_to_id) {
                  const { data: replyToData } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('id', newMsg.reply_to_id)
                    .maybeSingle();
                  if (replyToData) {
                    messageWithReply.reply_to = replyToData as Message;
                  }
                }
                setMessages((prev) => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, messageWithReply];
                });
                fetchConversations();
              }
            } else if (payload.eventType === 'UPDATE') {
              const updatedMsg = payload.new as Message;
              setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
            } else if (payload.eventType === 'DELETE') {
              const deletedMsg = payload.old as Message;
              setMessages((prev) => prev.filter(m => m.id !== deletedMsg.id));
              fetchConversations();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation, user, fetchMessages, fetchConversations]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: 'Lỗi',
          description: 'Tệp quá lớn. Vui lòng chọn tệp nhỏ hơn 50MB.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImageSelection = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedConversation || (!newMessage.trim() && !selectedImage)) return;

    setIsSending(true);
    try {
      let imageUrl = null;

      if (selectedImage) {
        setIsUploadingImage(true);
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, selectedImage);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
        setIsUploadingImage(false);
      }

      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: selectedConversation.id,
        content: newMessage.trim() || null,
        image_url: imageUrl,
        reply_to_id: replyingTo?.id || null,
      });

      if (error) throw error;
      setNewMessage('');
      clearImageSelection();
      setReplyingTo(null);
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
      setIsUploadingImage(false);
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editContent.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          content: editContent.trim(),
          edited_at: new Date().toISOString()
        })
        .eq('id', editingMessage.id);

      if (error) throw error;

      setMessages(prev => prev.map(m => 
        m.id === editingMessage.id 
          ? { ...m, content: editContent.trim(), edited_at: new Date().toISOString() }
          : m
      ));
      setEditingMessage(null);
      setEditContent('');
      toast({ title: 'Đã chỉnh sửa tin nhắn' });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể chỉnh sửa tin nhắn.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Xóa tin nhắn này? Tin nhắn sẽ bị xóa với cả hai bên.')) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.filter(m => m.id !== messageId));
      fetchConversations();
      toast({ title: 'Đã xóa tin nhắn' });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa tin nhắn.',
        variant: 'destructive',
      });
    }
  };

  const handleReport = async () => {
    if (!user || !selectedConversation || !reportReason) return;

    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_user_id: selectedConversation.id,
        reason: reportReason,
        description: reportDescription || null,
      });

      if (error) throw error;

      toast({
        title: 'Đã gửi báo cáo',
        description: 'Báo cáo của bạn đã được gửi đến quản trị viên.',
      });

      setShowReportDialog(false);
      setReportReason('');
      setReportDescription('');
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi báo cáo. Vui lòng thử lại.',
        variant: 'destructive',
      });
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) =>
      conv.participant?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.participant?.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  const handleSelectConversation = useCallback((conv: Conversation) => {
    setSelectedConversation(conv);
    setReplyingTo(null);
    fetchMessages(conv.id);
  }, [fetchMessages]);

  const handleBackToList = useCallback(() => {
    setSelectedConversation(null);
    setReplyingTo(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [newMessage, selectedImage, selectedConversation, user, replyingTo]);

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-primary/20');
      setTimeout(() => element.classList.remove('bg-primary/20'), 2000);
    }
  };

  return (
    <MainLayout>
      <div className="h-[calc(100vh-5rem)] glass rounded-2xl overflow-hidden">
        <div className="grid md:grid-cols-[350px_1fr] h-full">
          {/* Conversation List */}
          <div className={cn(
            "border-r border-border h-full overflow-hidden flex flex-col",
            isMobileView && selectedConversation && "hidden"
          )}>
            <div className="p-4 border-b border-border">
              <h2 className="text-xl font-bold mb-4">Tin nhắn</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm cuộc trò chuyện..."
                  className="pl-10 rounded-xl bg-secondary/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 animate-shimmer">
                      <div className="w-12 h-12 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-muted rounded" />
                        <div className="h-3 w-48 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">Chưa có cuộc trò chuyện nào</p>
                  <p className="text-sm text-muted-foreground mt-2">Hãy tìm bạn bè và bắt đầu trò chuyện!</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors",
                      selectedConversation?.id === conv.id && "bg-secondary"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conv.participant?.avatar_url || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {conv.participant?.display_name?.charAt(0).toUpperCase() || conv.participant?.username?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full text-[10px] flex items-center justify-center text-primary-foreground font-bold">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold truncate">
                          {conv.participant?.display_name || conv.participant?.username || 'Người dùng'}
                        </h3>
                        {conv.lastMessage && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conv.lastMessage.created_at), {
                              addSuffix: false,
                              locale: vi,
                            })}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className={cn(
                          "text-sm truncate",
                          conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                        )}>
                          {conv.lastMessage.sender_id === user?.id && 'Bạn: '}
                          {conv.lastMessage.image_url && !conv.lastMessage.content ? '📷 Hình ảnh' : conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={cn(
            "h-full overflow-hidden flex flex-col",
            isMobileView && !selectedConversation && "hidden"
          )}>
            {selectedConversation ? (
              <>
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isMobileView && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl mr-1"
                        onClick={handleBackToList}
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </Button>
                    )}
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedConversation.participant?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {selectedConversation.participant?.display_name?.charAt(0).toUpperCase() || selectedConversation.participant?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">
                        {selectedConversation.participant?.display_name || selectedConversation.participant?.username || 'Người dùng'}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        @{selectedConversation.participant?.username || 'unknown'}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-xl">
                        <MoreVertical className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass">
                      <DropdownMenuItem
                        onClick={() => setShowReportDialog(true)}
                        className="text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        Báo cáo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div 
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-3 relative scrollbar-thin"
                >
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-muted-foreground">Bắt đầu cuộc trò chuyện</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        id={`message-${msg.id}`}
                        className={cn(
                          "flex transition-colors duration-500",
                          msg.sender_id === user?.id ? "justify-end" : "justify-start"
                        )}
                      >
                        <div className={cn(
                          "max-w-[75%] relative group",
                          msg.sender_id === user?.id ? "pr-2" : "pl-2"
                        )}>
                          {/* Message actions for receiver - Reply button */}
                          {msg.sender_id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute -right-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setReplyingTo(msg)}
                            >
                              <Reply className="w-4 h-4" />
                            </Button>
                          )}
                          
                          {/* Message actions for sender */}
                          {msg.sender_id === user?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute -left-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="glass">
                                <DropdownMenuItem
                                  onClick={() => setReplyingTo(msg)}
                                  className="cursor-pointer"
                                >
                                  <Reply className="w-4 h-4 mr-2" />
                                  Trả lời
                                </DropdownMenuItem>
                                {msg.content && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingMessage(msg);
                                      setEditContent(msg.content || '');
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Chỉnh sửa
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Xóa
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          
                          {/* Single message block with reply */}
                          <div
                            className={cn(
                              "rounded-2xl overflow-hidden",
                              msg.sender_id === user?.id
                                ? "gradient-primary text-primary-foreground rounded-br-sm"
                                : "bg-secondary text-secondary-foreground rounded-bl-sm"
                            )}
                          >
                            {/* Reply reference inside message */}
                            {msg.reply_to && (
                              <div 
                                className={cn(
                                  "px-3 py-2 border-b cursor-pointer hover:opacity-80",
                                  msg.sender_id === user?.id 
                                    ? "bg-black/20 border-white/10" 
                                    : "bg-muted/50 border-border/50"
                                )}
                                onClick={() => scrollToMessage(msg.reply_to!.id)}
                              >
                                <div className="flex items-center gap-1 text-[10px] opacity-70 mb-0.5">
                                  <Reply className="w-3 h-3" />
                                  <span>Trả lời</span>
                                </div>
                                <p className="text-xs truncate opacity-80">
                                  {msg.reply_to.image_url && !msg.reply_to.content 
                                    ? '📷 Hình ảnh' 
                                    : msg.reply_to.content}
                                </p>
                              </div>
                            )}
                            
                            {/* Main message content */}
                            <div className="px-4 py-2">
                              {msg.image_url && (
                                <img
                                  src={msg.image_url}
                                  alt="Message image"
                                  className="rounded-lg max-w-full mb-2 cursor-pointer hover:opacity-90"
                                  onClick={() => window.open(msg.image_url!, '_blank')}
                                />
                              )}
                              {msg.content && (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              )}
                              <div className="flex items-center gap-1">
                                <p className={cn(
                                  "text-[10px] mt-1",
                                  msg.sender_id === user?.id ? "text-primary-foreground/70" : "text-muted-foreground"
                                )}>
                                  {formatDistanceToNow(new Date(msg.created_at), {
                                    addSuffix: true,
                                    locale: vi,
                                  })}
                                </p>
                                {msg.edited_at && (
                                  <span className={cn(
                                    "text-[10px] mt-1",
                                    msg.sender_id === user?.id ? "text-primary-foreground/70" : "text-muted-foreground"
                                  )}>
                                    (đã chỉnh sửa)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                  
                  {/* Scroll to bottom button */}
                  {showScrollToBottom && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="fixed bottom-28 right-8 md:absolute md:bottom-24 md:right-6 rounded-full shadow-lg z-10 h-10 w-10"
                      onClick={scrollToBottom}
                    >
                      <ArrowDown className="w-5 h-5" />
                    </Button>
                  )}
                </div>

                <div className="p-4 border-t border-border">
                  {/* Reply preview */}
                  {replyingTo && (
                    <div className="mb-3 p-3 bg-secondary/50 rounded-xl flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Reply className="w-3 h-3" />
                          <span>Đang trả lời</span>
                        </div>
                        <p className="text-sm truncate">
                          {replyingTo.image_url && !replyingTo.content 
                            ? '📷 Hình ảnh' 
                            : replyingTo.content}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full shrink-0"
                        onClick={() => setReplyingTo(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  
                  {imagePreview && (
                    <div className="mb-3 relative inline-block">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-20 w-20 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={clearImageSelection}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="rounded-xl shrink-0">
                      <Smile className="w-5 h-5" />
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                    >
                      <Image className="w-5 h-5" />
                    </Button>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Nhập tin nhắn..."
                      className="flex-1 h-10 px-4 rounded-xl bg-secondary/50 border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                      onKeyDown={handleKeyDown}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={isSending || isUploadingImage || (!newMessage.trim() && !selectedImage)}
                      size="icon"
                      className="rounded-xl gradient-primary shadow-glow shrink-0"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Chọn cuộc trò chuyện</h3>
                  <p className="text-muted-foreground">
                    Chọn một cuộc trò chuyện từ danh sách bên trái
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Báo cáo người dùng</DialogTitle>
            <DialogDescription>
              Báo cáo sẽ được gửi đến quản trị viên để xem xét
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lý do báo cáo</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Chọn lý do" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="harassment">Quấy rối</SelectItem>
                  <SelectItem value="inappropriate">Nội dung không phù hợp</SelectItem>
                  <SelectItem value="fake">Tài khoản giả mạo</SelectItem>
                  <SelectItem value="other">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mô tả chi tiết (tùy chọn)</Label>
              <Textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Mô tả chi tiết vấn đề..."
                className="rounded-xl"
              />
            </div>
            <Button
              onClick={handleReport}
              disabled={!reportReason}
              className="w-full rounded-xl gradient-primary"
            >
              Gửi báo cáo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Message Dialog */}
      <Dialog open={!!editingMessage} onOpenChange={() => setEditingMessage(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa tin nhắn</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Nội dung tin nhắn..."
              className="rounded-xl"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingMessage(null)}
                className="flex-1 rounded-xl"
              >
                Hủy
              </Button>
              <Button
                onClick={handleEditMessage}
                disabled={!editContent.trim()}
                className="flex-1 rounded-xl gradient-primary"
              >
                Lưu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Messages;
