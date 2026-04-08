'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { nb } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import LoadingSpinner from './loading-spinner';

// All 30-min slots from 07:00 to 18:30
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = 7 + Math.floor(i / 2);
  const min = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${min}`;
});

interface SlotData {
  time: string;
  minutes: number;
}

interface DaySlots {
  slots: SlotData[];
  windows: { start: string; end: string }[];
  bookings: { time: string; minutes: number }[];
  availableRanges: { start: string; end: string }[];
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
  const initialLoadDone = useRef(false);

  const fetchSlots = useCallback(async (isInitial = false) => {
    if (!userId) return;
    if (isInitial) setLoading(true);

    const from = format(new Date(), 'yyyy-MM-dd');
    const to = format(addDays(new Date(), daysAhead), 'yyyy-MM-dd');

    try {
      const res = await fetch(`/api/availability/slots?userId=${userId}&from=${from}&to=${to}&slotDuration=${slotDuration}`);
      const data = await res.json();
      setSlotsData(data.slots || {});
      // Auto-select first available date on initial load
      if (isInitial) {
        const dates = Object.keys(data.slots || {}).sort();
        const firstWithSlots = dates.find((d) => (data.slots[d]?.slots?.length || 0) > 0);
        if (firstWithSlots && !selectedDate) {
          setActiveDate(firstWithSlots);
        }
      }
    } catch {
      if (isInitial) setSlotsData({});
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [userId, slotDuration, daysAhead, selectedDate]);

  // Initial fetch
  useEffect(() => {
    initialLoadDone.current = false;
    fetchSlots(true).then(() => { initialLoadDone.current = true; });
  }, [fetchSlots]);

  // Auto-refresh every 15 seconds to catch bookings from other users
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      if (initialLoadDone.current) fetchSlots(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [userId, fetchSlots]);

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Show dates that have any availability ranges (not just free slots)
  const allDates = Object.keys(slotsData).sort();
  const datesWithAvailability = allDates.filter(
    (d) => slotsData[d].availableRanges?.length > 0 || slotsData[d].slots.length > 0
  );

  if (datesWithAvailability.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-gray-500">Ingen ledige tider funnet</p>
        <p className="text-xs text-gray-400 mt-1">Brukeren har ikke satt opp tilgjengelighet</p>
      </div>
    );
  }

  const dayData = activeDate ? slotsData[activeDate] : null;
  const availableSlotTimes = new Set(dayData?.slots.map((s) => s.time) || []);

  // Determine slot state: 'available' | 'booked' | 'unavailable'
  const getSlotState = (time: string): 'available' | 'booked' | 'unavailable' => {
    if (!dayData) return 'unavailable';

    // Check if booked (slot falls within a booking's 2h window)
    const [th, tm] = time.split(':').map(Number);
    const timeMin = th * 60 + tm;
    const isBooked = dayData.bookings?.some((b) => {
      return timeMin >= b.minutes && timeMin < b.minutes + 120;
    });
    if (isBooked) return 'booked';

    // Check if available (in the free slots list)
    if (availableSlotTimes.has(time)) return 'available';

    // Check if within availability range but taken by booking
    const inAvailableRange = dayData.availableRanges?.some((r) => {
      return time >= r.start && time < r.end;
    });
    if (inAvailableRange) return 'booked'; // within range but not free = booked

    return 'unavailable';
  };

  return (
    <div className="space-y-4">
      {/* Date strip */}
      <div>
        <label className="label">Dato</label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {datesWithAvailability.map((dateStr) => {
            const d = new Date(dateStr + 'T12:00:00');
            const isSelected = activeDate === dateStr;
            const slotCount = slotsData[dateStr]?.slots.length || 0;
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

      {/* Time grid — all slots with color coding */}
      {activeDate && (
        <div>
          <label className="label">Tid</label>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map((time) => {
              const state = getSlotState(time);
              const isUserSelected = selectedDate === activeDate && selectedTime === time;
              return (
                <button
                  key={time}
                  onClick={() => {
                    if (state === 'available') onSelect(activeDate, time);
                  }}
                  disabled={state !== 'available'}
                  className={cn(
                    'py-2 rounded-xl text-sm font-medium transition-colors',
                    isUserSelected
                      ? 'bg-black text-white ring-2 ring-black ring-offset-1'
                      : state === 'available'
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : state === 'booked'
                          ? 'bg-gray-900 text-white cursor-not-allowed'
                          : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {time}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
              <span>Ledig</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gray-900" />
              <span>Oppdrag</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
              <span>Utilgjengelig</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
