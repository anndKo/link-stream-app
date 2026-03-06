// @ts-nocheck
import { useState, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MoreVertical, Reply, Pencil, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { cn } from '@/lib/utils';

interface TradingMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_id?: string | null;
}

interface TradingMessageBubbleProps {
  msg: TradingMessage;
  userId: string | undefined;
  isAdmin?: boolean;
  allMessages: TradingMessage[];
  onImageClick: (url: string | null) => void;
  onReply: (msg: TradingMessage) => void;
  onEdit: (msg: TradingMessage) => void;
  onRecall: (msgId: string) => void;
  partnerName?: string;
}

export const TradingMessageBubble = ({
  msg,
  userId,
  isAdmin,
  allMessages,
  onImageClick,
  onReply,
  onEdit,
  onRecall,
  partnerName,
}: TradingMessageBubbleProps) => {
  const [showRecallConfirm, setShowRecallConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const isSender = msg.sender_id === userId;
  const isRecalled = !!msg.deleted_at;

  // Find replied message
  const repliedMsg = msg.reply_to_id
    ? allMessages.find(m => m.id === msg.reply_to_id)
    : null;

  // Long press handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    longPressTimer.current = setTimeout(() => {
      setShowMobileMenu(true);
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel long press if moving
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const currentX = e.touches[0].clientX;
    touchCurrentX.current = currentX;
    const diff = currentX - touchStartX.current;

    // Swipe to reply: left for sender, right for receiver
    if (isSender && diff < -10) {
      setSwipeOffset(Math.max(diff, -60));
    } else if (!isSender && diff > 10) {
      setSwipeOffset(Math.min(diff, 60));
    }
  }, [isSender]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // If swiped enough, trigger reply
    if (Math.abs(swipeOffset) > 40 && !isRecalled) {
      onReply(msg);
    }
    setSwipeOffset(0);
  }, [swipeOffset, msg, onReply, isRecalled]);

  // Recalled message display
  if (isRecalled && !isAdmin) {
    return (
      <div className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[70%] rounded-2xl p-3 bg-secondary/50 border border-border/50">
          <p className="text-sm text-muted-foreground italic">🚫 Tin nhắn đã thu hồi</p>
        </div>
      </div>
    );
  }

  const menuItems = (
    <>
      {!isRecalled && (
        <DropdownMenuItem onClick={() => onReply(msg)} className="cursor-pointer gap-2">
          <Reply className="w-4 h-4" />
          Trả lời
        </DropdownMenuItem>
      )}
      {isSender && !isRecalled && (
        <>
          <DropdownMenuItem onClick={() => onEdit(msg)} className="cursor-pointer gap-2">
            <Pencil className="w-4 h-4" />
            Chỉnh sửa
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowRecallConfirm(true)}
            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
          >
            <Undo2 className="w-4 h-4" />
            Thu hồi
          </DropdownMenuItem>
        </>
      )}
    </>
  );

  return (
    <>
      <div
        className={`flex items-center gap-1 group ${isSender ? 'justify-end' : 'justify-start'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 3-dot menu - left side for receiver messages */}
        {!isSender && !isRecalled && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="glass z-[100]">
              {menuItems}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Swipe reply indicator */}
        {!isSender && swipeOffset > 20 && (
          <div className="flex items-center text-primary animate-fade-in">
            <Reply className="w-4 h-4" />
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'max-w-[70%] rounded-2xl p-3 break-words overflow-hidden transition-transform',
            isSender
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary',
            isRecalled && isAdmin && 'opacity-60 border border-dashed border-destructive/50'
          )}
          style={{ transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined }}
        >
          {/* Reply preview */}
          {repliedMsg && (
            <div className={cn(
              'text-xs mb-2 p-2 rounded-lg border-l-2',
              isSender
                ? 'bg-primary-foreground/10 border-primary-foreground/30'
                : 'bg-muted border-muted-foreground/30'
            )}>
              <span className={cn(
                'font-medium block',
                isSender ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}>
                {repliedMsg.sender_id === userId ? 'Bạn' : (partnerName || 'Người dùng')}
              </span>
              <span className={cn(
                'line-clamp-2',
                isSender ? 'text-primary-foreground/60' : 'text-muted-foreground/80'
              )}>
                {repliedMsg.deleted_at ? '🚫 Tin nhắn đã thu hồi' : (repliedMsg.content || '📷 Hình ảnh')}
              </span>
            </div>
          )}

          {/* Admin badge for recalled messages */}
          {isRecalled && isAdmin && (
            <p className="text-[10px] text-destructive font-medium mb-1">
              🚫 Đã thu hồi (admin vẫn xem được nội dung)
            </p>
          )}

          {msg.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
          )}
          {msg.image_url && (
            <img
              src={msg.image_url}
              alt="Message"
              className="max-w-full rounded mt-1 cursor-pointer block"
              style={{ maxHeight: '200px', objectFit: 'contain' }}
              onClick={() => onImageClick(msg.image_url)}
            />
          )}
          <div className={cn(
            'flex items-center gap-1.5 mt-1',
            isSender ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}>
            <span className="text-[10px]">
              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: vi })}
            </span>
            {msg.edited_at && !isRecalled && (
              <span className="text-[10px] italic">· đã chỉnh sửa</span>
            )}
          </div>
        </div>

        {/* 3-dot menu - right side for sender messages */}
        {isSender && !isRecalled && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass z-[100]">
              {menuItems}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Swipe reply indicator - right side for sender */}
        {isSender && swipeOffset < -20 && (
          <div className="flex items-center text-primary animate-fade-in">
            <Reply className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Mobile long-press menu */}
      {showMobileMenu && !isRecalled && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center" onClick={() => setShowMobileMenu(false)}>
          <div className="bg-background rounded-xl shadow-xl p-2 min-w-[200px] glass" onClick={e => e.stopPropagation()}>
            <button
              className="w-full text-left px-4 py-3 text-sm hover:bg-secondary rounded-lg flex items-center gap-3"
              onClick={() => { setShowMobileMenu(false); onReply(msg); }}
            >
              <Reply className="w-4 h-4" /> Trả lời
            </button>
            {isSender && (
              <>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-secondary rounded-lg flex items-center gap-3"
                  onClick={() => { setShowMobileMenu(false); onEdit(msg); }}
                >
                  <Pencil className="w-4 h-4" /> Chỉnh sửa
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-secondary rounded-lg flex items-center gap-3 text-destructive"
                  onClick={() => { setShowMobileMenu(false); setShowRecallConfirm(true); }}
                >
                  <Undo2 className="w-4 h-4" /> Thu hồi
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Recall confirmation */}
      <AlertDialog open={showRecallConfirm} onOpenChange={setShowRecallConfirm}>
        <AlertDialogContent className="glass z-[210]">
          <AlertDialogHeader>
            <AlertDialogTitle>Thu hồi tin nhắn</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn thu hồi tin nhắn này không? Tin nhắn sẽ không còn hiển thị với người nhận.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onRecall(msg.id); setShowRecallConfirm(false); }}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Thu hồi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
