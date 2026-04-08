'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Home, User, Phone, MapPin } from 'lucide-react';
import Tabs from '@/components/ui/tabs';
import Card from '@/components/ui/card';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';

interface TechVisit {
  id: string;
  unitNumber: string;
  address: string;
  postalCode: string | null;
  city: string | null;
  ownerName: string | null;
  residentName: string | null;
  ownerPhone: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  workOrder: {
    id: string;
    status: string;
    scheduledAt: string;
  } | null;
}

const statusColors: Record<string, string> = {
  ny: 'bg-blue-100 text-blue-700',
  bestilt: 'bg-green-100 text-green-700',
};

const statusLabels: Record<string, string> = {
  ny: 'Ny',
  bestilt: 'Bestilt',
};

export default function TeknikerBesokPage() {
  const router = useRouter();
  const [tab, setTab] = useState('aktive');
  const [visits, setVisits] = useState<TechVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVisits() {
      try {
        const res = await fetch('/api/tech-visits');
        const data = await res.json();
        setVisits(data.visits || []);
      } catch {
        setVisits([]);
      } finally {
        setLoading(false);
      }
    }
    fetchVisits();
  }, []);

  const aktive = visits.filter((v) => v.status === 'ny');
  const bestilt = visits.filter((v) => v.status === 'bestilt');

  const tabs = [
    { id: 'aktive', label: 'Aktive', count: aktive.length },
    { id: 'bestilt', label: 'Bestilt', count: bestilt.length },
    { id: 'alle', label: 'Alle', count: visits.length },
  ];

  const getFilteredVisits = () => {
    switch (tab) {
      case 'aktive': return aktive;
      case 'bestilt': return bestilt;
      case 'alle': return visits;
      default: return aktive;
    }
  };

  const filtered = getFilteredVisits();

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <h1 className="page-title mb-4">Mine besøk</h1>

      <Tabs tabs={tabs} activeTab={tab} onChange={setTab} className="mb-4" />

      {filtered.length === 0 ? (
        <EmptyState
          title="Ingen besøk"
          description={
            tab === 'aktive'
              ? 'Du har ingen aktive besøk. Trykk + for å registrere et nytt.'
              : tab === 'bestilt'
                ? 'Ingen besøk er bestilt ennå'
                : 'Ingen besøk registrert'
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((visit) => (
            <Card
              key={visit.id}
              hover
              padding="none"
              onClick={() => router.push(`/tekniker/besok/${visit.id}`)}
              className={`border-l-4 ${visit.status === 'bestilt' ? 'border-l-green-400' : 'border-l-blue-400'}`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-lg bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
                      {visit.unitNumber}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{visit.residentName || visit.ownerName || 'Ukjent'}</h3>
                      <p className="text-xs text-gray-500">{formatDate(visit.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[visit.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[visit.status] || visit.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{visit.address}{visit.postalCode ? `, ${visit.postalCode}` : ''}{visit.city ? ` ${visit.city}` : ''}</span>
                  </div>
                  {visit.ownerPhone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{visit.ownerPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push('/tekniker/besok/ny')}
        className="fixed bottom-24 right-5 h-14 w-14 rounded-full bg-black text-white shadow-lg flex items-center justify-center hover:bg-gray-800 transition-colors z-10"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
