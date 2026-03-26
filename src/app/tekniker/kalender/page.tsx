'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MapPin, Clock, Wrench, Check, X, ChevronRight, Trash2 } from 'lucide-react';
import { addDays, startOfWeek, isSameDay, isSameWeek, differenceInMinutes } from 'date-fns';
import Calendar from '@/components/ui/calendar';
import Card from '@/components/ui/card';
import ToggleTabs from '@/components/ui/toggle-tabs';
import StatusBadge from '@/components/ui/status-badge';
import EmptyState from '@/components/ui/empty-state';
import LoadingSpinner from '@/components/ui/loading-spinner';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import { cn, formatTime, formatDateLong, formatDayName, formatDateShort } from '@/lib/utils';
import { toDateString } from '@/lib/availability';
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

const MAIN_TABS = [
  { id: 'oppdrag', label: 'Oppdrag' },
  { id: 'tilgjengelighet', label: 'Tilgjengelighet' },
];

const VIEW_TABS = [
  { id: 'dag', label: 'Dag' },
  { id: 'uke', label: 'Uke' },
  { id: 'maned', label: 'Måned' },
];

const TIMELINE_HOURS = Array.from({ length: 12 }, (_, i) => 7 + i);
const DAYS_SHORT = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'];

function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export default function TeknikerKalenderPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;

  const [activeTab, setActiveTab] = useState('oppdrag');
  const [activeView, setActiveView] = useState('maned');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Delete state ──
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [woRes, availRes] = await Promise.all([
        fetch('/api/work-orders?all=true'),
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

  const now = new Date();

  // ── Stats ──
  const stats = useMemo(() => {
    const todayStr = toDateString(now);
    const active = workOrders.filter((wo) => wo.status !== 'fullfort');

    const today = active.filter((wo) => toDateString(new Date(wo.scheduledAt)) === todayStr).length;
    const week = active.filter((wo) => {
      const d = new Date(wo.scheduledAt);
      return isSameWeek(d, now, { weekStartsOn: 1 });
    }).length;
    const done = workOrders.filter((wo) => wo.status === 'fullfort').length;
    const pending = active.filter(
      (wo) => wo.status === 'planlagt' && new Date(wo.scheduledAt) >= now
    ).length;

    return { today, week, done, pending };
  }, [workOrders]);

  // Calendar dots
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

  for (let i = 0; i < 60; i++) {
    const d = addDays(now, i);
    const ds = toDateString(d);
    if (seenDates.has(ds)) continue;

    const hasOverride = availability.some(
      (a) => a.date && toDateString(new Date(a.date)) === ds
    );
    if (hasOverride) {
      seenDates.add(ds);
      dotDates.push(d);
    }
  }

  // Helpers
  const getOrdersForDate = (dateStr: string) =>
    workOrders
      .filter((wo) => toDateString(new Date(wo.scheduledAt)) === dateStr)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const selectedDateStr = toDateString(selectedDate);
  const dayOrders = getOrdersForDate(selectedDateStr);

  // Upcoming
  const upcoming = useMemo(() => {
    const nowMs = now.getTime();
    return workOrders
      .filter((wo) => wo.status === 'planlagt' && new Date(wo.scheduledAt).getTime() > nowMs)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 3);
  }, [workOrders]);

  // Navigation
  const navPrev = () => {
    const d = new Date(viewDate);
    if (activeView === 'maned') d.setMonth(d.getMonth() - 1);
    else if (activeView === 'uke') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setViewDate(d);
    if (activeView === 'dag') setSelectedDate(d);
  };

  const navNext = () => {
    const d = new Date(viewDate);
    if (activeView === 'maned') d.setMonth(d.getMonth() + 1);
    else if (activeView === 'uke') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setViewDate(d);
    if (activeView === 'dag') setSelectedDate(d);
  };

  const goToday = () => {
    const today = new Date();
    setViewDate(today);
    setSelectedDate(today);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setViewDate(date);
    setActiveView('dag');
  };

  const handleViewChange = (view: string) => {
    setActiveView(view);
    if (view === 'dag') setViewDate(new Date(selectedDate));
  };

  // Countdown
  const getCountdown = (scheduledAt: string) => {
    const diff = differenceInMinutes(new Date(scheduledAt), now);
    if (diff < 0) return null;
    if (diff < 60) return { text: `om ${diff} min`, soon: true };
    const hrs = Math.floor(diff / 60);
    if (hrs < 24) return { text: `om ${hrs} time${hrs > 1 ? 'r' : ''}`, soon: hrs <= 2 };
    const days = Math.floor(diff / 1440);
    return { text: `om ${days} dag${days > 1 ? 'er' : ''}`, soon: false };
  };

  // ── Availability logic ──
  const dateOverrides = availability.filter(
    (a) => a.date && toDateString(new Date(a.date)) === selectedDateStr
  );
  const blockedEntries = dateOverrides.filter((a) => a.isBlocked);
  const isFullDayBlocked = blockedEntries.some(
    (a) => a.startTime === '00:00' && a.endTime >= '23:59'
  );

  const isSlotAvailable = (time: string): boolean => {
    if (isFullDayBlocked) return false;
    const isBlocked = blockedEntries.some((b) => timeInRange(time, b.startTime, b.endTime));
    if (isBlocked) return false;
    const availableOverrides = dateOverrides.filter((a) => !a.isBlocked);
    if (availableOverrides.length > 0) {
      return availableOverrides.some((a) => timeInRange(time, a.startTime, a.endTime));
    }
    return time >= '07:00' && time < '19:00';
  };

  const getSlotBooking = (time: string): WorkOrder | undefined => {
    return dayOrders.find((wo) => {
      const woTime = formatTime(wo.scheduledAt);
      const [wh, wm] = woTime.split(':').map(Number);
      const [th, tm] = time.split(':').map(Number);
      const woMin = wh * 60 + wm;
      const tMin = th * 60 + tm;
      return tMin >= woMin && tMin < woMin + 60;
    });
  };

  const toggleSlot = async (time: string) => {
    if (!userId) return;
    setSaving(true);

    const [h, m] = time.split(':').map(Number);
    const endMin = h * 60 + m + 30;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

    const isAvail = isSlotAvailable(time);

    try {
      if (isAvail) {
        await fetch('/api/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            entries: [{ date: selectedDateStr, startTime: time, endTime, isBlocked: true }],
          }),
        });
      } else {
        const blockEntry = blockedEntries.find((b) => timeInRange(time, b.startTime, b.endTime));
        if (blockEntry) {
          await fetch(`/api/availability/${blockEntry.id}`, { method: 'DELETE' });

          const newBlocks: { date: string; startTime: string; endTime: string; isBlocked: boolean }[] = [];
          if (blockEntry.startTime < time) {
            newBlocks.push({ date: selectedDateStr, startTime: blockEntry.startTime, endTime: time, isBlocked: true });
          }
          if (endTime < blockEntry.endTime) {
            newBlocks.push({ date: selectedDateStr, startTime: endTime, endTime: blockEntry.endTime, isBlocked: true });
          }
          if (newBlocks.length > 0) {
            await fetch('/api/availability', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, entries: newBlocks }),
            });
          }
        }
      }
      await fetchData();
    } catch {
      toast.error('Kunne ikke oppdatere');
    } finally {
      setSaving(false);
    }
  };

  const markDayAvailable = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      if (dateOverrides.length > 0) {
        await fetch('/api/availability', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: dateOverrides.map((a) => a.id) }),
        });
      }
      toast.success('Hele dagen satt som ledig');
      await fetchData();
    } catch {
      toast.error('Kunne ikke oppdatere');
    } finally {
      setSaving(false);
    }
  };

  const markDayUnavailable = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      if (dateOverrides.length > 0) {
        await fetch('/api/availability', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: dateOverrides.map((a) => a.id) }),
        });
      }
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

  // ── Delete handler ──
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/work-orders/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Oppdrag slettet');
      setDeleteId(null);
      fetchData();
    } catch {
      toast.error('Kunne ikke slette oppdrag');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <h1 className="page-title mb-3">Kalender</h1>

      {/* ── Main tabs ── */}
      <div className="flex justify-center mb-4">
        <ToggleTabs tabs={MAIN_TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* ════════════════ OPPDRAG TAB ════════════════ */}
      {activeTab === 'oppdrag' && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { value: stats.today, label: 'I dag' },
              { value: stats.week, label: 'Denne uka' },
              { value: stats.done, label: 'Utført' },
              { value: stats.pending, label: 'Gjenstår' },
            ].map((s) => (
              <Card key={s.label} padding="sm">
                <div className="text-xl font-bold text-gray-900 leading-tight">{s.value}</div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{s.label}</div>
              </Card>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex justify-center mb-3">
            <ToggleTabs tabs={VIEW_TABS} activeTab={activeView} onChange={handleViewChange} />
          </div>

          {/* ── Month view ── */}
          {activeView === 'maned' && (
            <>
              <Card className="mb-4">
                <Calendar
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  dotDates={dotDates}
                />
              </Card>

              {upcoming.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Neste oppdrag
                  </h3>
                  <div className="space-y-2">
                    {upcoming.map((wo) => {
                      const countdown = getCountdown(wo.scheduledAt);
                      return (
                        <Card
                          key={wo.id}
                          hover
                          onClick={() => {
                            setSelectedDate(new Date(wo.scheduledAt));
                            setViewDate(new Date(wo.scheduledAt));
                            setActiveView('dag');
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'text-[11px] font-semibold px-2.5 py-1 rounded-md text-center min-w-[60px]',
                                countdown?.soon
                                  ? 'bg-orange-50 text-orange-600'
                                  : 'bg-blue-50 text-blue-600'
                              )}
                            >
                              {countdown?.text || formatTime(wo.scheduledAt)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{wo.organization.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {formatTime(wo.scheduledAt)} · {wo.units.length} enheter
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Week view ── */}
          {activeView === 'uke' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button onClick={navPrev} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">←</button>
                <h2 className="text-sm font-semibold">
                  {(() => {
                    const mon = getMondayOfWeek(viewDate);
                    const sun = addDays(mon, 6);
                    return `${formatDateShort(mon)} – ${formatDateShort(sun)}`;
                  })()}
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={goToday} className="text-xs text-gray-500 hover:text-gray-900 font-medium">I dag</button>
                  <button onClick={navNext} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">→</button>
                </div>
              </div>

              {Array.from({ length: 7 }, (_, i) => {
                const mon = getMondayOfWeek(viewDate);
                const day = addDays(mon, i);
                const dayStr = toDateString(day);
                const orders = getOrdersForDate(dayStr);
                const isToday = isSameDay(day, now);

                return (
                  <div key={dayStr}>
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold uppercase text-gray-400 tracking-wide">
                        {DAYS_SHORT[i]}
                      </span>
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          isToday && 'bg-black text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs'
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    {orders.length === 0 ? (
                      <p className="text-xs text-gray-300 italic pl-1 mb-2">Ingen oppdrag</p>
                    ) : (
                      <div className="space-y-1.5 mb-2">
                        {orders.map((wo) => (
                          <WorkOrderCard key={wo.id} wo={wo} onDelete={(id) => setDeleteId(id)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Day view (timeline) ── */}
          {activeView === 'dag' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <button onClick={navPrev} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">←</button>
                <h2 className="text-sm font-semibold">
                  {formatDayName(viewDate).replace(/^\w/, (c) => c.toUpperCase())} {viewDate.getDate()}. {formatDateShort(viewDate).split('. ')[1]}
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={goToday} className="text-xs text-gray-500 hover:text-gray-900 font-medium">I dag</button>
                  <button onClick={navNext} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">→</button>
                </div>
              </div>

              <div>
                {TIMELINE_HOURS.map((hour) => {
                  const label = `${String(hour).padStart(2, '0')}:00`;
                  const hourOrders = dayOrders.filter(
                    (wo) => new Date(wo.scheduledAt).getHours() === hour
                  );

                  return (
                    <div key={hour} className="flex min-h-[56px] border-t border-gray-100">
                      <div className="w-11 text-right pr-2.5 pt-1 text-[11px] font-medium text-gray-400 flex-shrink-0">
                        {label}
                      </div>
                      <div className="flex-1 py-1">
                        {hourOrders.map((wo) => (
                          <WorkOrderCard key={wo.id} wo={wo} onDelete={(id) => setDeleteId(id)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {dayOrders.length === 0 && (
                <EmptyState
                  title="Ingen oppdrag"
                  description="Du har ingen oppdrag denne dagen"
                />
              )}
            </div>
          )}
        </>
      )}

      {/* ── Delete confirmation modal ── */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Slett oppdrag">
        <p className="text-sm text-gray-600 mb-4">
          Er du sikker på at du vil slette dette oppdraget? Handlingen kan ikke angres.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)} fullWidth>
            Avbryt
          </Button>
          <Button onClick={handleDelete} isLoading={deleting} fullWidth className="!bg-red-600 hover:!bg-red-700">
            Slett
          </Button>
        </div>
      </Modal>

      {/* ════════════════ TILGJENGELIGHET TAB ════════════════ */}
      {activeTab === 'tilgjengelighet' && (
        <>
          <Card className="mb-4">
            <Calendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              dotDates={dotDates}
            />
          </Card>

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
        </>
      )}
    </div>
  );
}

// ── Work order card component ──
function WorkOrderCard({ wo, onDelete }: { wo: WorkOrder; onDelete: (id: string) => void }) {
  const router = useRouter();

  const statusColor =
    wo.status === 'fullfort'
      ? 'border-l-green-500 opacity-70'
      : wo.status === 'pagaar'
        ? 'border-l-yellow-500'
        : 'border-l-blue-500';

  return (
    <div
      onClick={() => router.push(`/tekniker/oppdrag/${wo.id}`)}
      className={cn(
        'bg-white border border-gray-200 rounded-xl p-3 cursor-pointer transition-all hover:shadow-sm border-l-[3px]',
        statusColor
      )}
    >
      <div className="flex items-start justify-between mb-1">
        <span className="text-sm font-semibold">{wo.organization.name}</span>
        <div className="flex items-center gap-1.5">
          <StatusBadge type="workOrder" status={wo.status} />
          {wo.status !== 'fullfort' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(wo.id);
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-500 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <span>{formatTime(wo.scheduledAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{wo.organization.address}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wrench className="h-3 w-3" />
          <span>{wo.units.length} enheter</span>
        </div>
      </div>
    </div>
  );
}
