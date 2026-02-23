import { cn, getInitials } from '@/lib/utils';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export default function Avatar({ name, imageUrl, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'rounded-full bg-black text-white flex items-center justify-center font-semibold overflow-hidden',
        sizeStyles[size],
        className
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
