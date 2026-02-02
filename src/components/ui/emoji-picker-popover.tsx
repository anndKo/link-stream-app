import { useState, useCallback, memo } from 'react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { Smile } from 'lucide-react';

interface EmojiPickerPopoverProps {
  onEmojiSelect: (emoji: string) => void;
}

export const EmojiPickerPopover = memo(({ onEmojiSelect }: EmojiPickerPopoverProps) => {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = useCallback((emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
  }, [onEmojiSelect]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="rounded-xl gap-2">
          <Smile className="w-5 h-5" />
          <span className="hidden sm:inline">Emoji</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 border-0" 
        align="start"
        sideOffset={8}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          theme={Theme.AUTO}
          width={320}
          height={400}
          searchPlaceholder="Tìm emoji..."
          previewConfig={{ showPreview: false }}
          lazyLoadEmojis
        />
      </PopoverContent>
    </Popover>
  );
});

EmojiPickerPopover.displayName = 'EmojiPickerPopover';
