'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Clock, Wrench } from 'lucide-react';
import Calendar from '@/components/ui/calendar';
import Card from '@/components/ui/card';
import StatusBadge from '@/components/ui/status-badge';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import { formatTime, formatDateLong } from '@/lib/utils';

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

export default function TeknikerKalenderPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkOrders() {
      try {
        const res = await fetch('/api/work-orders');
        const data = await res.json();
        setWorkOrders(data.workOrders || []);
      } catch {
        setWorkOrders([]);
      } finally {
        setLoading(false);
      }
    }
    fetchWorkOrders();
  }, []);

  const dotDates = workOrders
    .filter((wo) => wo.status !== 'fullfort')
    .map((wo) => new Date(wo.scheduledAt));

  const dayOrders = workOrders.filter((wo) => {
    const d = new Date(wo.scheduledAt);
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

      {dayOrders.length === 0 ? (
        <EmptyState
          title="Ingen oppdrag"
          description="Ingen oppdrag planlagt denne dagen"
        />
      ) : (
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
      )}
    </div>
  );
}
