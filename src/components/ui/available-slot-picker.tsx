'use client';

import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { nb } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import LoadingSpinner from './loading-spinner';

interface SlotData {
  time: string;
  minutes: number;
}

interface DaySlots {
  slots: SlotData[];
  windows: { start: string; end: string }[];
}

interface AvailableSlotPickerProps {
  userId: string;
  onSelect: (date: string, time: string) => void;
  slotDuration?: number;
  daysAhead?: number;
  selectedDate?: string | null;
  selectedTime?: string | null;
}

export default function AvailableSlotPicker({
  userId,
  onSelect,
  slotDuration = 30,
  daysAhead = 21,
  selectedDate,
  selectedTime,
}: AvailableSlotPickerProps) {
  const [slotsData, setSlotsData] = useState<Record<string, DaySlots>>({});
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string | null>(selectedDate || null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const from = format(new Date(), 'yyyy-MM-dd');
    const to = format(addDays(new Date(), daysAhead), 'yyyy-MM-dd');

    fetch(`/api/availability/slots?userId=${userId}&from=${from}&to=${to}&slotDuration=${slotDuration}`)
      .then((res) => res.json())
      .then((data) => {
        setSlotsData(data.slots || {});
        // Auto-select first available date
        const dates = Object.keys(data.slots || {}).sort();
        const firstWithSlots = dates.find((d) => (data.slots[d]?.slots?.length || 0) > 0);
        if (firstWithSlots && !selectedDate) {
          setActiveDate(firstWithSlots);
        }
      })
      .catch(() => setSlotsData({}))
      .finally(() => setLoading(false));
  }, [userId, slotDuration, daysAhead, selectedDate]);

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const availableDates = Object.keys(slotsData)
    .filter((d) => slotsData[d].slots.length > 0)
    .sort();

  if (availableDates.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-gray-500">Ingen ledige tider funnet</p>
        <p className="text-xs text-gray-400 mt-1">Brukeren har ikke satt opp tilgjengelighet</p>
      </div>
    );
  }

  const activeSlots = activeDate ? slotsData[activeDate]?.slots || [] : [];

  return (
    <div className="space-y-4">
      {/* Date strip */}
      <div>
        <label className="label">Dato</label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {availableDates.map((dateStr) => {
            const d = new Date(dateStr + 'T12:00:00');
            const isSelected = activeDate === dateStr;
            const slotCount = slotsData[dateStr].slots.length;
            return (
              <button
                key={dateStr}
                onClick={() => setActiveDate(dateStr)}
                className={cn(
                  'flex flex-col items-center min-w-[52px] px-2 py-2 rounded-xl text-xs transition-colors',
                  isSelected
                    ? 'bg-black text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                )}
              >
                <span className="font-medium">{format(d, 'EEE', { locale: nb })}</span>
                <span className="text-lg font-bold">{format(d, 'd')}</span>
                <span>{format(d, 'MMM', { locale: nb })}</span>
                <span className={cn('text-[10px] mt-0.5', isSelected ? 'text-gray-300' : 'text-gray-400')}>
                  {slotCount} ledig
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time grid */}
      {activeDate && activeSlots.length > 0 && (
        <div>
          <label className="label">Tid</label>
          <div className="grid grid-cols-4 gap-2">
            {activeSlots.map((slot) => (
              <button
                key={slot.time}
                onClick={() => onSelect(activeDate, slot.time)}
                className={cn(
                  'py-2 rounded-xl text-sm font-medium transition-colors',
                  selectedDate === activeDate && selectedTime === slot.time
                    ? 'bg-black text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                )}
              >
                {slot.time}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
