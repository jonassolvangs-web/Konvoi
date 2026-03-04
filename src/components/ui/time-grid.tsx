'use client';

import { cn } from '@/lib/utils';

interface TimeWindow {
  start: string; // "HH:mm"
  end: string;
}

interface Booking {
  time: string; // "HH:mm"
  endTime?: string;
  label: string;
}

interface TimeGridProps {
  date: Date;
  availabilityWindows: TimeWindow[];
  bookings: Booking[];
  onSlotClick?: (time: string) => void;
  startHour?: number;
  endHour?: number;
}

function timeToOffset(time: string, startHour: number, endHour: number): number {
  const [h, m] = time.split(':').map(Number);
  const totalRange = (endHour - startHour) * 60;
  const offset = (h * 60 + m) - startHour * 60;
  return Math.max(0, Math.min(100, (offset / totalRange) * 100));
}

function timeToHeight(start: string, end: string, startHour: number, endHour: number): number {
  const totalRange = (endHour - startHour) * 60;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const duration = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, (duration / totalRange) * 100);
}

export default function TimeGrid({
  availabilityWindows,
  bookings,
  onSlotClick,
  startHour = 7,
  endHour = 19,
}: TimeGridProps) {
  const hours = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h);
  }

  const totalHeight = (endHour - startHour) * 60; // px per minute = 1

  return (
    <div className="relative" style={{ height: `${totalHeight}px` }}>
      {/* Hour lines */}
      {hours.map((h) => (
        <div
          key={h}
          className="absolute w-full flex items-start"
          style={{ top: `${timeToOffset(`${String(h).padStart(2, '0')}:00`, startHour, endHour)}%` }}
        >
          <span className="text-[10px] text-gray-400 w-10 -mt-1.5 text-right pr-2 shrink-0">
            {String(h).padStart(2, '0')}:00
          </span>
          <div className="flex-1 border-t border-gray-100" />
        </div>
      ))}

      {/* Availability windows (green) */}
      {availabilityWindows.map((w, i) => (
        <div
          key={`avail-${i}`}
          className={cn(
            'absolute left-10 right-0 rounded-lg bg-green-50 border border-green-200',
            onSlotClick && 'cursor-pointer hover:bg-green-100'
          )}
          style={{
            top: `${timeToOffset(w.start, startHour, endHour)}%`,
            height: `${timeToHeight(w.start, w.end, startHour, endHour)}%`,
          }}
          onClick={() => onSlotClick?.(w.start)}
        >
          <span className="text-[10px] text-green-700 px-2 py-0.5 block">
            {w.start} - {w.end}
          </span>
        </div>
      ))}

      {/* Bookings (blue/dark) */}
      {bookings.map((b, i) => {
        const endTime = b.endTime || (() => {
          const [h, m] = b.time.split(':').map(Number);
          const end = h * 60 + m + 60;
          return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
        })();
        return (
          <div
            key={`book-${i}`}
            className="absolute left-10 right-0 rounded-lg bg-gray-900 text-white z-10"
            style={{
              top: `${timeToOffset(b.time, startHour, endHour)}%`,
              height: `${timeToHeight(b.time, endTime, startHour, endHour)}%`,
            }}
          >
            <div className="px-2 py-1">
              <p className="text-[10px] font-medium truncate">{b.label}</p>
              <p className="text-[10px] opacity-70">{b.time} - {endTime}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
