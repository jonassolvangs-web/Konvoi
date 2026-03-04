'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MapPin, Clock, Wrench, Check, X } from 'lucide-react';
import { addDays } from 'date-fns';
import Calendar from '@/components/ui/calendar';
import Card from '@/components/ui/card';
import StatusBadge from '@/components/ui/status-badge';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { formatTime, formatDateLong } from '@/lib/utils';
import { toDateString, getISODayOfWeek } from '@/lib/availability';
import toast from 'react-hot-toast';

interface WorkOrder {
  id: string;
  scheduledAt: string;
  status: string;
  organization: {
    id: string;
    name: string;
    address: string;
  };
  units: { id: string }[];
}

interface AvailabilityEntry {
  id: string;
  dayOfWeek: number | null;
  date: string | null;
  startTime: string;
  endTime: string;
  isBlocked: boolean;
}

// Generate half-hour slots from 07:00 to 18:30
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = 7 + Math.floor(i / 2);
  const min = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${min}`;
});

function timeInRange(time: string, start: string, end: string): boolean {
  return time >= start && time < end;
}

export default function TeknikerKalenderPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [woRes, availRes] = await Promise.all([
        fetch('/api/work-orders'),
        fetch(`/api/availability?userId=${userId}`),
      ]);

      const woData = await woRes.json();
      const availData = await availRes.json();

      setWorkOrders(woData.workOrders || []);
      setAvailability(availData.availability || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calendar dots: days with work orders or availability
  const dotDates: Date[] = [];
  const seenDates = new Set<string>();

  workOrders.forEach((wo) => {
    if (wo.status !== 'fullfort') {
      const ds = toDateString(new Date(wo.scheduledAt));
      if (!seenDates.has(ds)) {
        seenDates.add(ds);
        dotDates.push(new Date(wo.scheduledAt));
      }
    }
  });

  // Add dots for days with availability (next 60 days)
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = addDays(today, i);
    const ds = toDateString(d);
    if (seenDates.has(ds)) continue;
    const dow = getISODayOfWeek(d);

    // Check date-specific overrides
    const dateOverride = availability.find(
      (a) => a.date && toDateString(new Date(a.date)) === ds
    );
    if (dateOverride) {
      if (!dateOverride.isBlocked) {
        seenDates.add(ds);
        dotDates.push(d);
      }
      continue;
    }

    // Check weekly template
    const hasTemplate = availability.some(
      (a) => a.dayOfWeek === dow && a.date === null
    );
    if (hasTemplate) {
      seenDates.add(ds);
      dotDates.push(d);
    }
  }

  // Selected day data
  const selectedDateStr = toDateString(selectedDate);
  const selectedDow = getISODayOfWeek(selectedDate);

  const dayOrders = workOrders.filter(
    (wo) => toDateString(new Date(wo.scheduledAt)) === selectedDateStr
  );

  // Get availability windows for selected day
  const dateOverrides = availability.filter(
    (a) => a.date && toDateString(new Date(a.date)) === selectedDateStr
  );
  const hasDateOverride = dateOverrides.length > 0;
  const isBlockedDay = dateOverrides.some((a) => a.isBlocked);

  const dayWindows = isBlockedDay
    ? []
    : hasDateOverride
      ? dateOverrides.filter((a) => !a.isBlocked)
      : availability.filter((a) => a.dayOfWeek === selectedDow && a.date === null);

  // Which time slots are "available"
  const isSlotAvailable = (time: string): boolean => {
    if (isBlockedDay) return false;
    return dayWindows.some((w) => timeInRange(time, w.startTime, w.endTime));
  };

  // Which time slots have a booking
  const getSlotBooking = (time: string): WorkOrder | undefined => {
    return dayOrders.find((wo) => {
      const woTime = formatTime(wo.scheduledAt);
      // Booking occupies 1 hour from its start
      const [wh, wm] = woTime.split(':').map(Number);
      const [th, tm] = time.split(':').map(Number);
      const woMin = wh * 60 + wm;
      const tMin = th * 60 + tm;
      return tMin >= woMin && tMin < woMin + 60;
    });
  };

  // Toggle a single slot
  const toggleSlot = async (time: string) => {
    if (!userId) return;
    setSaving(true);

    const [h, m] = time.split(':').map(Number);
    const endMin = h * 60 + m + 30;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

    const isAvail = isSlotAvailable(time);

    try {
      if (isAvail) {
        // Remove this slot: need to find the window that covers it and split/shrink
        // Simple approach: delete all date overrides for this date, recalculate
        await removeTimeFromDay(time, endTime);
      } else {
        // Add this slot as available
        await addTimeToDay(time, endTime);
      }
      await fetchData();
    } catch {
      toast.error('Kunne ikke oppdatere');
    } finally {
      setSaving(false);
    }
  };

  // Add a time range to the selected day
  const addTimeToDay = async (startTime: string, endTime: string) => {
    // Always use date-specific entries for manual toggles
    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        entries: [{ date: selectedDateStr, startTime, endTime }],
      }),
    });
  };

  // Remove a time range from the day's availability
  const removeTimeFromDay = async (startTime: string, endTime: string) => {
    // Find which entries cover this slot
    if (hasDateOverride) {
      // Work with date-specific entries
      for (const entry of dateOverrides) {
        if (entry.isBlocked) continue;
        if (timeInRange(startTime, entry.startTime, entry.endTime)) {
          // Delete this entry and recreate the remaining parts
          await fetch(`/api/availability/${entry.id}`, { method: 'DELETE' });

          const newEntries: { date: string; startTime: string; endTime: string }[] = [];
          if (entry.startTime < startTime) {
            newEntries.push({ date: selectedDateStr, startTime: entry.startTime, endTime: startTime });
          }
          if (endTime < entry.endTime) {
            newEntries.push({ date: selectedDateStr, startTime: endTime, endTime: entry.endTime });
          }
          if (newEntries.length > 0) {
            await fetch('/api/availability', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, entries: newEntries }),
            });
          }
          break;
        }
      }
    } else {
      // Has weekly template - create a date-specific override that excludes this slot
      // First, get the template windows
      const templateWindows = availability.filter(
        (a) => a.dayOfWeek === selectedDow && a.date === null
      );

      // Create date entries for each template window, excluding the removed slot
      const newEntries: { date: string; startTime: string; endTime: string }[] = [];
      for (const tw of templateWindows) {
        if (timeInRange(startTime, tw.startTime, tw.endTime)) {
          if (tw.startTime < startTime) {
            newEntries.push({ date: selectedDateStr, startTime: tw.startTime, endTime: startTime });
          }
          if (endTime < tw.endTime) {
            newEntries.push({ date: selectedDateStr, startTime: endTime, endTime: tw.endTime });
          }
        } else {
          newEntries.push({ date: selectedDateStr, startTime: tw.startTime, endTime: tw.endTime });
        }
      }

      // Also add a blocked entry to suppress the template, then add back the remaining windows
      await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          entries: [
            { date: selectedDateStr, startTime: '00:00', endTime: '00:01', isBlocked: true },
            ...newEntries,
          ],
        }),
      });
    }
  };

  // Quick: mark entire day as available (08:00-17:00)
  const markDayAvailable = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // Remove existing date overrides for this day
      const existing = availability.filter(
        (a) => a.date && toDateString(new Date(a.date)) === selectedDateStr
      );
      if (existing.length > 0) {
        await fetch('/api/availability', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: existing.map((a) => a.id) }),
        });
      }

      await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          entries: [{ date: selectedDateStr, startTime: '07:00', endTime: '19:00' }],
        }),
      });

      toast.success('Hele dagen satt som ledig');
      await fetchData();
    } catch {
      toast.error('Kunne ikke oppdatere');
    } finally {
      setSaving(false);
    }
  };

  // Quick: mark entire day as unavailable
  const markDayUnavailable = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // Remove existing date overrides
      const existing = availability.filter(
        (a) => a.date && toDateString(new Date(a.date)) === selectedDateStr
      );
      if (existing.length > 0) {
        await fetch('/api/availability', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: existing.map((a) => a.id) }),
        });
      }

      // Add blocked entry to suppress weekly template
      await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          entries: [{ date: selectedDateStr, startTime: '00:00', endTime: '23:59', isBlocked: true }],
        }),
      });

      toast.success('Hele dagen satt som utilgjengelig');
      await fetchData();
    } catch {
      toast.error('Kunne ikke oppdatere');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const anyAvailable = TIME_SLOTS.some((t) => isSlotAvailable(t));

  return (
    <div className="page-container">
      <h1 className="page-title mb-4">Kalender</h1>

      {/* Monthly calendar */}
      <Card className="mb-4">
        <Calendar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          dotDates={dotDates}
        />
      </Card>

      {/* Selected day header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">
          {formatDateLong(selectedDate)}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={markDayAvailable}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Ledig
          </button>
          <button
            onClick={markDayUnavailable}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            Opptatt
          </button>
        </div>
      </div>

      {/* Time slot grid */}
      <Card className="mb-4">
        <p className="text-xs text-gray-400 mb-3">Trykk på en tid for å endre tilgjengelighet</p>
        <div className="grid grid-cols-4 gap-1.5">
          {TIME_SLOTS.map((time) => {
            const available = isSlotAvailable(time);
            const booking = getSlotBooking(time);
            const hasBooking = !!booking;

            return (
              <button
                key={time}
                onClick={() => !hasBooking && toggleSlot(time)}
                disabled={saving || hasBooking}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                  hasBooking
                    ? 'bg-gray-900 text-white cursor-default'
                    : available
                      ? 'bg-green-100 text-green-800 hover:bg-green-200 active:scale-95'
                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100 active:scale-95'
                } disabled:opacity-70`}
              >
                {time}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-green-100 border border-green-200" />
            <span className="text-[10px] text-gray-500">Ledig</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-gray-900" />
            <span className="text-[10px] text-gray-500">Oppdrag</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-gray-50 border border-gray-200" />
            <span className="text-[10px] text-gray-500">Utilgjengelig</span>
          </div>
        </div>
      </Card>

      {/* Work orders for selected day */}
      {dayOrders.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Oppdrag ({dayOrders.length})
          </h2>
          <div className="space-y-2">
            {dayOrders.map((wo) => (
              <Card
                key={wo.id}
                hover
                onClick={() => router.push(`/tekniker/oppdrag/${wo.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold">{wo.organization.name}</h3>
                  <StatusBadge type="workOrder" status={wo.status} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatTime(wo.scheduledAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{wo.organization.address}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Wrench className="h-3.5 w-3.5" />
                    <span>{wo.units.length} enheter</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
