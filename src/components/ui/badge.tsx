import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function Badge({ children, color = 'bg-gray-100 text-gray-700', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        color,
        className
      )}
    >
      {children}
    </span>
  );
}
