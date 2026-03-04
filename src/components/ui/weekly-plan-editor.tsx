'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface DayTemplate {
  dayOfWeek: number; // 1=Man..7=Sun
  startTime: string;
  endTime: string;
  enabled: boolean;
}

interface WeeklyPlanEditorProps {
  templates: DayTemplate[];
  onChange: (templates: DayTemplate[]) => void;
}

const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

function defaultTemplates(): DayTemplate[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dow) => ({
    dayOfWeek: dow,
    startTime: '08:00',
    endTime: '16:00',
    enabled: dow <= 5,
  }));
}

export default function WeeklyPlanEditor({ templates, onChange }: WeeklyPlanEditorProps) {
  const [days, setDays] = useState<DayTemplate[]>(() => {
    if (templates.length === 0) return defaultTemplates();
    // Merge existing templates with defaults
    return [1, 2, 3, 4, 5, 6, 7].map((dow) => {
      const existing = templates.find((t) => t.dayOfWeek === dow);
      if (existing) return { ...existing, enabled: true };
      return { dayOfWeek: dow, startTime: '08:00', endTime: '16:00', enabled: false };
    });
  });

  const update = (index: number, patch: Partial<DayTemplate>) => {
    const next = days.map((d, i) => (i === index ? { ...d, ...patch } : d));
    setDays(next);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {days.map((day, i) => (
        <div
          key={day.dayOfWeek}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl transition-colors',
            day.enabled ? 'bg-white border border-gray-200' : 'bg-gray-50'
          )}
        >
          {/* Toggle */}
          <button
            onClick={() => update(i, { enabled: !day.enabled })}
            className={cn(
              'w-12 h-7 rounded-full relative transition-colors shrink-0',
              day.enabled ? 'bg-black' : 'bg-gray-300'
            )}
          >
            <div
              className={cn(
                'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform',
                day.enabled ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>

          {/* Day name */}
          <span className={cn('text-sm font-medium w-8', !day.enabled && 'text-gray-400')}>
            {dayNames[day.dayOfWeek - 1]}
          </span>

          {/* Time inputs */}
          {day.enabled && (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="time"
                value={day.startTime}
                onChange={(e) => update(i, { startTime: e.target.value })}
                className="input-field text-sm py-1.5 px-2 w-24"
              />
              <span className="text-gray-400 text-xs">-</span>
              <input
                type="time"
                value={day.endTime}
                onChange={(e) => update(i, { endTime: e.target.value })}
                className="input-field text-sm py-1.5 px-2 w-24"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
