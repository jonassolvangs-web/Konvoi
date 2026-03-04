'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MapPin, Clock, Plus, Save } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { nb } from 'date-fns/locale';
import Calendar from '@/components/ui/calendar';
import Card from '@/components/ui/card';
import ToggleTabs from '@/components/ui/toggle-tabs';
import StatusBadge from '@/components/ui/status-badge';
import TimeGrid from '@/components/ui/time-grid';
import WeeklyPlanEditor, { type DayTemplate } from '@/components/ui/weekly-plan-editor';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import { formatTime, formatDateLong } from '@/lib/utils';
import { toDateString } from '@/lib/availability';
import toast from 'react-hot-toast';

interface Appointment {
  id: string;
  scheduledAt: string;
  endAt: string | null;
  status: string;
  organization: {
    id: string;
    name: string;
    address: string;
    numUnits: number;
  };
}

interface AvailabilityEntry {
  id: string;
  dayOfWeek: number | null;
  date: string | null;
  startTime: string;
  endTime: string;
  isBlocked: boolean;
}

interface DaySlots {
  slots: { time: string; minutes: number }[];
  windows: { start: string; end: string }[];
}

export default function FeltselgerKalenderPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;

  const [tab, setTab] = useState('kalender');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [slotsData, setSlotsData] = useState<Record<string, DaySlots>>({});
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<DayTemplate[] | null>(null);

  // Add override modal
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideStart, setOverrideStart] = useState('08:00');
  const [overrideEnd, setOverrideEnd] = useState('16:00');
  const [overrideIsBlocked, setOverrideIsBlocked] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const from = toDateString(new Date());
      const to = toDateString(addDays(new Date(), 30));

      const [aptRes, availRes, slotsRes] = await Promise.all([
        fetch('/api/appointments'),
        fetch(`/api/availability?userId=${userId}`),
        fetch(`/api/availability/slots?userId=${userId}&from=${from}&to=${to}`),
      ]);

      const aptData = await aptRes.json();
      const availData = await availRes.json();
      const slotsDataRes = await slotsRes.json();

      setAppointments(aptData.appointments || []);
      setAvailability(availData.availability || []);
      setSlotsData(slotsDataRes.slots || {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calendar dot dates: appointments + availability days
  const appointmentDates = appointments
    .filter((a) => a.status !== 'kansellert')
    .map((a) => new Date(a.scheduledAt));

  const availabilityDotDates = Object.keys(slotsData)
    .filter((d) => slotsData[d].windows.length > 0)
    .map((d) => new Date(d + 'T12:00:00'));

  const dotDates = [...appointmentDates, ...availabilityDotDates];

  // Day data
  const selectedDateStr = toDateString(selectedDate);
  const dayAppointments = appointments.filter((a) => {
    const d = new Date(a.scheduledAt);
    return toDateString(d) === selectedDateStr;
  });

  const daySlots = slotsData[selectedDateStr];
  const dayWindows = daySlots?.windows || [];

  // Bookings for TimeGrid
  const dayBookings = dayAppointments.map((apt) => ({
    time: formatTime(apt.scheduledAt),
    endTime: apt.endAt ? formatTime(apt.endAt) : undefined,
    label: apt.organization.name,
  }));

  // Templates for WeeklyPlanEditor
  const templates: DayTemplate[] = availability
    .filter((a) => a.dayOfWeek !== null && a.date === null)
    .map((a) => ({
      dayOfWeek: a.dayOfWeek!,
      startTime: a.startTime,
      endTime: a.endTime,
      enabled: true,
    }));

  // Date overrides
  const dateOverrides = availability.filter((a) => a.date !== null);

  const handleSaveWeeklyPlan = async (plan: DayTemplate[]) => {
    if (!userId) return;
    setSavingPlan(true);
    try {
      // Delete existing templates
      const templateIds = availability
        .filter((a) => a.dayOfWeek !== null && a.date === null)
        .map((a) => a.id);

      if (templateIds.length > 0) {
        await fetch('/api/availability', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: templateIds }),
        });
      }

      // Create new templates
      const entries = plan
        .filter((d) => d.enabled)
        .map((d) => ({
          dayOfWeek: d.dayOfWeek,
          startTime: d.startTime,
          endTime: d.endTime,
        }));

      if (entries.length > 0) {
        await fetch('/api/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, entries }),
        });
      }

      toast.success('Ukentlig plan lagret');
      fetchData();
    } catch {
      toast.error('Kunne ikke lagre plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleAddOverride = async () => {
    if (!userId || !overrideDate) return;
    setSavingOverride(true);
    try {
      await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          entries: [{
            date: overrideDate,
            startTime: overrideStart,
            endTime: overrideEnd,
            isBlocked: overrideIsBlocked,
          }],
        }),
      });
      toast.success(overrideIsBlocked ? 'Dag blokkert' : 'Tilgjengelighet lagt til');
      setShowAddOverride(false);
      setOverrideDate('');
      setOverrideIsBlocked(false);
      fetchData();
    } catch {
      toast.error('Kunne ikke lagre');
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      await fetch(`/api/availability/${id}`, { method: 'DELETE' });
      toast.success('Slettet');
      fetchData();
    } catch {
      toast.error('Kunne ikke slette');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Kalender</h1>
        <ToggleTabs
          tabs={[
            { id: 'kalender', label: 'Kalender' },
            { id: 'tilgjengelighet', label: 'Tilgjengelighet' },
          ]}
          activeTab={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'kalender' ? (
        <>
          {/* Calendar */}
          <Card className="mb-4">
            <Calendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              dotDates={dotDates}
            />
          </Card>

          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            {formatDateLong(selectedDate)}
          </h2>

          {/* TimeGrid for selected day */}
          {(dayWindows.length > 0 || dayBookings.length > 0) ? (
            <Card className="mb-4">
              <TimeGrid
                date={selectedDate}
                availabilityWindows={dayWindows}
                bookings={dayBookings}
              />
            </Card>
          ) : null}

          {/* Appointment list */}
          {dayAppointments.length === 0 && dayWindows.length === 0 ? (
            <EmptyState
              title="Ingen avtaler"
              description="Ingen avtaler eller tilgjengelighet denne dagen"
            />
          ) : (
            <div className="space-y-2">
              {dayAppointments.map((apt) => (
                <Card
                  key={apt.id}
                  hover
                  onClick={() => router.push('/feltselger/besok')}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold">{apt.organization.name}</h3>
                    <StatusBadge type="appointment" status={apt.status} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {formatTime(apt.scheduledAt)}
                        {apt.endAt && ` - ${formatTime(apt.endAt)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{apt.organization.address}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Tilgjengelighet tab ── */
        <div className="space-y-6">
          {/* Weekly plan */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Ukentlig plan</h2>
            <WeeklyPlanEditor
              templates={templates}
              onChange={(plan) => setPendingPlan(plan)}
            />
            <div className="mt-3">
              <Button
                fullWidth
                onClick={() => handleSaveWeeklyPlan(pendingPlan || templates)}
                isLoading={savingPlan}
              >
                <Save className="h-4 w-4" />
                Lagre ukentlig plan
              </Button>
            </div>
          </div>

          {/* Date overrides */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Dato-unntak</h2>
              <button
                onClick={() => setShowAddOverride(true)}
                className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Legg til
              </button>
            </div>

            {dateOverrides.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Ingen dato-unntak lagt til
              </p>
            ) : (
              <div className="space-y-2">
                {dateOverrides.map((override) => (
                  <Card key={override.id} padding="sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {override.date ? format(new Date(override.date), 'd. MMMM yyyy', { locale: nb }) : ''}
                        </p>
                        <p className="text-xs text-gray-500">
                          {override.isBlocked
                            ? 'Utilgjengelig hele dagen'
                            : `${override.startTime} - ${override.endTime}`
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteOverride(override.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Slett
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add override modal */}
      <Modal isOpen={showAddOverride} onClose={() => setShowAddOverride(false)} title="Legg til dato-unntak">
        <div className="space-y-4">
          <div>
            <label className="label">Dato</label>
            <input
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="label">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setOverrideIsBlocked(false)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  !overrideIsBlocked ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                Tilgjengelig
              </button>
              <button
                onClick={() => setOverrideIsBlocked(true)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  overrideIsBlocked ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                Utilgjengelig
              </button>
            </div>
          </div>

          {!overrideIsBlocked && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="label">Fra</label>
                <input
                  type="time"
                  value={overrideStart}
                  onChange={(e) => setOverrideStart(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div className="flex-1">
                <label className="label">Til</label>
                <input
                  type="time"
                  value={overrideEnd}
                  onChange={(e) => setOverrideEnd(e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>
          )}

          <Button fullWidth onClick={handleAddOverride} isLoading={savingOverride} disabled={!overrideDate}>
            Lagre
          </Button>
        </div>
      </Modal>
    </div>
  );
}
