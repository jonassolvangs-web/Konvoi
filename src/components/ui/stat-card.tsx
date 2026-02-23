import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon?: LucideIcon;
  value: string | number;
  label: string;
  color?: string;
  className?: string;
}

export default function StatCard({ icon: Icon, value, label, color, className }: StatCardProps) {
  return (
    <div className={cn('bg-white border border-gray-200 rounded-xl p-4', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn('p-2 rounded-lg', color || 'bg-gray-100')}>
            <Icon className="h-5 w-5" strokeWidth={1.5} />
          </div>
        )}
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
