'use client';

import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto no-scrollbar', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
            activeTab === tab.id
              ? 'bg-black text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span
              className={cn(
                'inline-flex items-center justify-center h-5 min-w-[20px] rounded-full text-xs font-semibold px-1',
                activeTab === tab.id ? 'bg-white text-black' : 'bg-gray-200 text-gray-700'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
