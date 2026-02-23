'use client';

import { cn } from '@/lib/utils';

interface ToggleTabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export default function ToggleTabs({ tabs, activeTab, onChange, className }: ToggleTabsProps) {
  return (
    <div className={cn('inline-flex bg-gray-100 rounded-full p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-black text-white'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
