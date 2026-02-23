'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Building2, Clock } from 'lucide-react';
import Tabs from '@/components/ui/tabs';
import Card from '@/components/ui/card';
import StatusBadge from '@/components/ui/status-badge';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import { formatDate, formatTime, formatDistance } from '@/lib/utils';

interface Visit {
  id: string;
  status: string;
  source: string;
  unitsSold: number;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    address: string;
    numUnits: number;
    distanceFromOfficeKm: number | null;
    distanceFromOfficeMin: number | null;
  };
  appointment: {
    scheduledAt: string;
    endAt: string | null;
  } | null;
  _count: { dwellingUnits: number };
}

interface Appointment {
  id: string;
  scheduledAt: string;
  endAt: string | null;
  status: string;
  notes: string | null;
  organization: {
    id: string;
    name: string;
    address: string;
    numUnits: number;
    distanceFromOfficeKm: number | null;
    distanceFromOfficeMin: number | null;
  };
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
}

function isThisWeek(date: Date): boolean {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return date >= startOfWeek && date < endOfWeek;
}

export default function FeltselgerBesokPage() {
  const router = useRouter();
  const [tab, setTab] = useState('idag');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [visitsRes, aptsRes] = await Promise.all([
          fetch('/api/visits'),
          fetch('/api/appointments?status=planlagt'),
        ]);
        const visitsData = await visitsRes.json();
        const aptsData = await aptsRes.json();
        setVisits(visitsData.visits || []);
        setAppointments(aptsData.appointments || []);
      } catch {
        setVisits([]);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const todayAppointments = appointments.filter(
    (a) => isToday(new Date(a.scheduledAt))
  );
  const weekAppointments = appointments.filter(
    (a) => isThisWeek(new Date(a.scheduledAt))
  );

  const todayVisits = visits.filter(
    (v) => v.appointment && isToday(new Date(v.appointment.scheduledAt))
  );
  const weekVisits = visits.filter(
    (v) => v.appointment && isThisWeek(new Date(v.appointment.scheduledAt))
  );

  const tabs = [
    { id: 'idag', label: 'I dag', count: todayAppointments.length + todayVisits.length },
    { id: 'uke', label: 'Denne uken', count: weekAppointments.length + weekVisits.length },
    { id: 'alle', label: 'Alle', count: visits.length },
  ];

  if (loading) return <LoadingSpinner />;

  const renderAppointmentCard = (apt: Appointment) => (
    <Card key={`apt-${apt.id}`} hover onClick={() => router.push(`/feltselger/besok`)}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-0.5">Avtale</p>
          <h3 className="text-sm font-semibold">{apt.organization.name}</h3>
        </div>
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
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Building2 className="h-3.5 w-3.5" />
          <span>{apt.organization.numUnits} enheter</span>
          {apt.organization.distanceFromOfficeKm != null && apt.organization.distanceFromOfficeMin != null && (
            <span className="text-gray-300 mx-1">|</span>
          )}
          {apt.organization.distanceFromOfficeKm != null && apt.organization.distanceFromOfficeMin != null && (
            <span>{formatDistance(apt.organization.distanceFromOfficeKm, apt.organization.distanceFromOfficeMin)}</span>
          )}
        </div>
      </div>
    </Card>
  );

  const renderVisitCard = (visit: Visit) => (
    <Card key={`visit-${visit.id}`} hover onClick={() => router.push(`/feltselger/besok/${visit.id}`)}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-0.5">Besøk</p>
          <h3 className="text-sm font-semibold">{visit.organization.name}</h3>
        </div>
        <StatusBadge type="visit" status={visit.status} />
      </div>

      <div className="space-y-1">
        {visit.appointment && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTime(visit.appointment.scheduledAt)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <MapPin className="h-3.5 w-3.5" />
          <span>{visit.organization.address}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Building2 className="h-3.5 w-3.5" />
          <span>
            {visit._count.dwellingUnits} / {visit.organization.numUnits} enheter
          </span>
          {visit.unitsSold > 0 && (
            <>
              <span className="text-gray-300 mx-1">|</span>
              <span className="text-green-600 font-medium">{visit.unitsSold} solgt</span>
            </>
          )}
        </div>
      </div>
    </Card>
  );

  const renderContent = () => {
    if (tab === 'idag') {
      const items = [...todayAppointments, ...todayVisits];
      if (items.length === 0) {
        return <EmptyState title="Ingen avtaler i dag" description="Du har ingen planlagte besøk i dag" />;
      }
      return (
        <div className="space-y-2">
          {todayAppointments.map(renderAppointmentCard)}
          {todayVisits.map(renderVisitCard)}
        </div>
      );
    }

    if (tab === 'uke') {
      const items = [...weekAppointments, ...weekVisits];
      if (items.length === 0) {
        return <EmptyState title="Ingen avtaler denne uken" description="Du har ingen planlagte besøk denne uken" />;
      }
      return (
        <div className="space-y-2">
          {weekAppointments.map(renderAppointmentCard)}
          {weekVisits.map(renderVisitCard)}
        </div>
      );
    }

    // alle
    if (visits.length === 0) {
      return <EmptyState title="Ingen besøk" description="Du har ingen besøk ennå" />;
    }
    return (
      <div className="space-y-2">
        {visits.map(renderVisitCard)}
      </div>
    );
  };

  return (
    <div className="page-container">
      <h1 className="page-title mb-4">Mine besøk</h1>

      <Tabs tabs={tabs} activeTab={tab} onChange={setTab} className="mb-4" />

      {renderContent()}
    </div>
  );
}
