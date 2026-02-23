'use client';

import { cn } from '@/lib/utils';

interface Chip {
  id: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  chips: Chip[];
  activeChip: string;
  onChange: (chipId: string) => void;
  className?: string;
}

export default function FilterChips({ chips, activeChip, onChange, className }: FilterChipsProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto no-scrollbar pb-1', className)}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          onClick={() => onChange(chip.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
            activeChip === chip.id
              ? 'bg-black text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          {chip.label}
          {chip.count !== undefined && (
            <span
              className={cn(
                'text-xs',
                activeChip === chip.id ? 'text-gray-300' : 'text-gray-400'
              )}
            >
              {chip.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
