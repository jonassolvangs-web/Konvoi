'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Phone, MapPin, ChevronDown, DoorOpen } from 'lucide-react';
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
  ownerBirthDate: string | null;
  residentName: string | null;
  ownerPhone: string | null;
  notHomeCount: number;
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
  ikke_hjemme: 'bg-amber-100 text-amber-700',
  tenker: 'bg-purple-100 text-purple-700',
  nei: 'bg-red-100 text-red-700',
  bestilt: 'bg-green-100 text-green-700',
};

const statusLabels: Record<string, string> = {
  ny: 'Ny',
  ikke_hjemme: 'Ikke hjemme',
  tenker: 'Tenker',
  nei: 'Nei',
  bestilt: 'Bestilt',
};

export default function TeknikerBesokPage() {
  const router = useRouter();
  const [tab, setTab] = useState('aktive');
  const [visits, setVisits] = useState<TechVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (address: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  };

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

  const aktive = visits.filter((v) => v.status === 'ny' && v.notHomeCount === 0);
  const ikkeHjemme = visits.filter((v) => v.status === 'ny' && v.notHomeCount > 0);
  const tenker = visits.filter((v) => v.status === 'tenker');
  const nei = visits.filter((v) => v.status === 'nei');
  const bestilt = visits.filter((v) => v.status === 'bestilt');

  const tabs = [
    { id: 'aktive', label: 'Aktive', count: aktive.length },
    { id: 'ikke_hjemme', label: 'Ikke hjemme', count: ikkeHjemme.length },
    { id: 'tenker', label: 'Tenker', count: tenker.length },
    { id: 'nei', label: 'Nei', count: nei.length },
    { id: 'bestilt', label: 'Bestilt', count: bestilt.length },
    { id: 'alle', label: 'Alle', count: visits.length },
  ];

  const getFilteredVisits = () => {
    switch (tab) {
      case 'aktive': return aktive;
      case 'ikke_hjemme': return ikkeHjemme;
      case 'tenker': return tenker;
      case 'nei': return nei;
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
              : tab === 'ikke_hjemme'
                ? 'Ingen besøk markert som ikke hjemme'
                : tab === 'bestilt'
                  ? 'Ingen besøk er bestilt ennå'
                  : 'Ingen besøk registrert'
          }
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(
            filtered.reduce<Record<string, TechVisit[]>>((groups, visit) => {
              const key = visit.address;
              if (!groups[key]) groups[key] = [];
              groups[key].push(visit);
              return groups;
            }, {})
          )
            .sort(([a], [b]) => a.localeCompare(b, 'nb'))
            .map(([address, groupVisits]) => {
              const isExpanded = expandedGroups.has(address);
              const bestiltCount = groupVisits.filter((v) => v.status === 'bestilt').length;
              return (
                <div key={address}>
                  <button
                    onClick={() => toggleGroup(address)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <h2 className="text-sm font-semibold text-gray-700">{address}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {bestiltCount > 0 && (
                        <span className="text-xs text-green-600 font-medium">{bestiltCount} bestilt</span>
                      )}
                      <span className="text-xs text-gray-400">{groupVisits.length} stk</span>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 mt-2">
                      {groupVisits.map((visit) => (
                        <Card
                          key={visit.id}
                          hover
                          padding="none"
                          onClick={() => router.push(`/tekniker/besok/${visit.id}`)}
                          className={`border-l-4 ${visit.status === 'bestilt' ? 'border-l-green-400' : 'border-l-blue-400'}`}
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex items-center gap-3">
                                <div className="h-11 min-w-[52px] px-2 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold">
                                  {visit.unitNumber}
                                </div>
                                <div>
                                  <h3 className="text-sm font-semibold">
                                {visit.ownerName || 'Ukjent'}
                                {visit.residentName && <span className="font-normal text-gray-500"> (Beboer: {visit.residentName})</span>}
                              </h3>
                                  {visit.ownerBirthDate && <p className="text-xs text-gray-500">Født: {visit.ownerBirthDate}</p>}
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                visit.notHomeCount > 0 && visit.status === 'ny'
                                  ? statusColors['ikke_hjemme']
                                  : statusColors[visit.status] || 'bg-gray-100 text-gray-600'
                              }`}>
                                {visit.notHomeCount > 0 && visit.status === 'ny'
                                  ? 'Ikke hjemme'
                                  : statusLabels[visit.status] || visit.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 ml-[64px]">
                              {visit.ownerPhone && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>{visit.ownerPhone}</span>
                                </div>
                              )}
                              {visit.notHomeCount > 0 && (
                                <div className="flex items-center gap-1 text-xs text-amber-600">
                                  <DoorOpen className="h-3.5 w-3.5" />
                                  <span>{visit.notHomeCount}x ikke hjemme</span>
                                </div>
                              )}
                            </div>
                            {visit.notes && (
                              <p className="text-xs text-gray-500 ml-[64px] mt-1 line-clamp-2">{visit.notes}</p>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
