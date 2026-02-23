import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

const sizeStyles = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

export default function LoadingSpinner({ size = 'md', fullPage }: LoadingSpinnerProps) {
  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className={cn('animate-spin text-gray-400', sizeStyles[size])} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className={cn('animate-spin text-gray-400', sizeStyles[size])} />
    </div>
  );
}
