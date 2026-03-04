import { cn } from '@/lib/utils';

export const parseImageUrls = (imageUrl: string | null): string[] => {
  if (!imageUrl) return [];
  try {
    if (imageUrl.startsWith('[')) {
      const parsed = JSON.parse(imageUrl);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [imageUrl];
};

interface ImageGridProps {
  images: string[];
  onImageClick?: (url: string) => void;
  className?: string;
  wideMobile?: boolean;
}

export const ImageGrid = ({ images, onImageClick, className, wideMobile }: ImageGridProps) => {
  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div
        className={cn(
          "rounded-xl overflow-hidden cursor-pointer",
          wideMobile && "-mx-3 sm:mx-0 rounded-none sm:rounded-xl",
          className
        )}
        onClick={() => onImageClick?.(images[0])}
      >
        <img
          src={images[0]}
          alt="Post"
          className="w-full max-h-[500px] object-contain hover:scale-[1.02] transition-transform duration-500"
          loading="lazy"
        />
      </div>
    );
  }

  const maxShow = 4;
  const displayImages = images.slice(0, maxShow);
  const remaining = images.length - maxShow;

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1 rounded-xl overflow-hidden",
        wideMobile && "-mx-3 sm:mx-0 rounded-none sm:rounded-xl",
        className
      )}
    >
      {displayImages.map((img, i) => (
        <div
          key={i}
          className="relative aspect-square cursor-pointer overflow-hidden"
          onClick={() => onImageClick?.(img)}
        >
          <img
            src={img}
            alt=""
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {i === maxShow - 1 && remaining > 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">+{remaining}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
