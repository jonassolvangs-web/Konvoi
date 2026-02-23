'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Clock } from 'lucide-react';
import Calendar from '@/components/ui/calendar';
import Card from '@/components/ui/card';
import StatusBadge from '@/components/ui/status-badge';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import { formatTime, formatDateLong } from '@/lib/utils';

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

export default function FeltselgerKalenderPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const res = await fetch('/api/appointments');
        const data = await res.json();
        setAppointments(data.appointments || []);
      } catch {
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAppointments();
  }, []);

  const dotDates = appointments
    .filter((a) => a.status !== 'kansellert')
    .map((a) => new Date(a.scheduledAt));

  const dayAppointments = appointments.filter((a) => {
    const d = new Date(a.scheduledAt);
    return (
      d.getFullYear() === selectedDate.getFullYear() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getDate() === selectedDate.getDate()
    );
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <h1 className="page-title mb-4">Kalender</h1>

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

      {dayAppointments.length === 0 ? (
        <EmptyState
          title="Ingen avtaler"
          description="Ingen avtaler planlagt denne dagen"
        />
      ) : (
        <div className="space-y-2">
          {dayAppointments.map((apt) => (
            <Card
              key={apt.id}
              hover
              onClick={() => router.push(`/feltselger/besok`)}
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
    </div>
  );
}
