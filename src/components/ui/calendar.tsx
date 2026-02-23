'use client';

import { useState } from 'react';
import { cn, formatDateShort } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  dotDates?: Date[];
  className?: string;
}

const WEEKDAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lo', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Calendar({ selectedDate, onDateSelect, dotDates = [], className }: CalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  const today = new Date();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0, Sunday = 6
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const hasDot = (date: Date) => dotDates.some((d) => isSameDay(d, date));

  return (
    <div className={cn('bg-white', className)}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-sm font-semibold">
          {MONTHS[month]} {year}
        </h3>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => (
          <div key={i} className="relative">
            {date ? (
              <button
                onClick={() => onDateSelect(date)}
                className={cn(
                  'w-full aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors',
                  isSameDay(date, selectedDate)
                    ? 'bg-black text-white'
                    : isSameDay(date, today)
                      ? 'bg-gray-100 font-semibold'
                      : 'hover:bg-gray-50'
                )}
              >
                {date.getDate()}
                {hasDot(date) && (
                  <div
                    className={cn(
                      'h-1 w-1 rounded-full mt-0.5',
                      isSameDay(date, selectedDate) ? 'bg-white' : 'bg-green-500'
                    )}
                  />
                )}
              </button>
            ) : (
              <div className="w-full aspect-square" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
