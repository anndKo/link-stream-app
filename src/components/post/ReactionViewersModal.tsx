// @ts-nocheck
import { memo, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface ReactionViewer {
  user_id: string;
  emoji: string;
  display_name: string;
  avatar_url: string | null;
}

interface ReactionViewersModalProps {
  open: boolean;
  onClose: () => void;
  reactions: { user_id: string; emoji: string }[];
}

export const ReactionViewersModal = memo(({ open, onClose, reactions }: ReactionViewersModalProps) => {
  const [viewers, setViewers] = useState<ReactionViewer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || reactions.length === 0) return;

    const fetchProfiles = async () => {
      setIsLoading(true);
      const userIds = [...new Set(reactions.map(r => r.user_id))];
      const { data } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((data || []).map(p => [p.id, p]));
      const result: ReactionViewer[] = reactions.map(r => {
        const profile = profileMap.get(r.user_id);
        return {
          user_id: r.user_id,
          emoji: r.emoji,
          display_name: profile?.display_name || 'Người dùng',
          avatar_url: profile?.avatar_url || null,
        };
      });
      setViewers(result);
      setIsLoading(false);
    };

    fetchProfiles();
  }, [open, reactions]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative w-full sm:max-w-sm bg-popover border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl animate-fade-in z-10"
        style={{ maxHeight: '60vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Cảm xúc ({reactions.length})</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-3 space-y-1" style={{ maxHeight: 'calc(60vh - 52px)' }}>
          {isLoading ? (
            <div className="text-center text-muted-foreground py-6 text-sm">Đang tải...</div>
          ) : viewers.length === 0 ? (
            <div className="text-center text-muted-foreground py-6 text-sm">Chưa có ai thả cảm xúc</div>
          ) : (
            viewers.map((v, i) => (
              <div key={`${v.user_id}-${i}`} className="flex items-center gap-3 p-2 rounded-xl bg-secondary/30">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={v.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {v.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate flex-1">{v.display_name}</span>
                <span className="text-lg">{v.emoji}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

ReactionViewersModal.displayName = 'ReactionViewersModal';
