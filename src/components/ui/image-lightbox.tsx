import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from './button';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageLightbox = ({ src, alt = 'Image', isOpen, onClose }: ImageLightboxProps) => {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      setScale(1);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onClose();
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.5, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5));

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fade-in overflow-auto"
      onClick={handleBackdropClick}
    >
      {/* Controls */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
          onClick={zoomOut}
        >
          <ZoomOut className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
          onClick={zoomIn}
        >
          <ZoomIn className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Image container - scrollable */}
      <div className="max-w-full max-h-full overflow-auto p-4">
        <img
          src={src}
          alt={alt}
          className="block mx-auto transition-transform duration-200"
          style={{ 
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            maxWidth: scale <= 1 ? '95vw' : 'none',
            maxHeight: scale <= 1 ? '90vh' : 'none',
          }}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      </div>
    </div>
  );
};
