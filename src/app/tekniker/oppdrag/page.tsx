'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Clock, Building2, Navigation, Trash2, Edit3 } from 'lucide-react';
import Tabs from '@/components/ui/tabs';
import Card from '@/components/ui/card';
import StatusBadge from '@/components/ui/status-badge';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import AvailableSlotPicker from '@/components/ui/available-slot-picker';
import { formatDate, formatTime, formatDistance } from '@/lib/utils';
import toast from 'react-hot-toast';

interface WorkOrder {
  id: string;
  technicianId: string;
  scheduledAt: string;
  status: string;
  completedAt: string | null;
  notes: string | null;
  organization: {
    id: string;
    name: string;
    address: string;
    distanceFromOfficeKm: number | null;
    distanceFromOfficeMin: number | null;
  };
  technician: { name: string };
  units: {
    id: string;
    dwellingUnit: { unitNumber: string; residentName: string | null };
    product: { name: string } | null;
  }[];
  techVisits: {
    notes: string | null;
  }[];
}

const statusBorderColors: Record<string, string> = {
  planlagt: 'border-l-blue-400',
  pagaar: 'border-l-yellow-400',
  fullfort: 'border-l-green-400',
};

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

export default function TeknikerOppdragPage() {
  const router = useRouter();
  const [tab, setTab] = useState('idag');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [savingDate, setSavingDate] = useState(false);

  const fetchWorkOrders = async () => {
    try {
      const res = await fetch('/api/work-orders');
      const data = await res.json();
      setWorkOrders(data.workOrders || []);
    } catch {
      setWorkOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/work-orders/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Oppdrag slettet');
      setDeleteId(null);
      fetchWorkOrders();
    } catch {
      toast.error('Kunne ikke slette oppdrag');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveDate = async (woId: string) => {
    if (!newDate || !newTime) {
      toast.error('Velg dato og klokkeslett');
      return;
    }
    setSavingDate(true);
    try {
      const scheduledAt = new Date(`${newDate}T${newTime}`).toISOString();
      await fetch(`/api/work-orders/${woId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt }),
      });
      toast.success('Tidspunkt oppdatert');
      setEditingDateId(null);
      setNewDate('');
      setNewTime('');
      fetchWorkOrders();
    } catch {
      toast.error('Kunne ikke oppdatere tidspunkt');
    } finally {
      setSavingDate(false);
    }
  };

  const activeOrders = workOrders.filter((wo) => wo.status !== 'fullfort');
  const todayOrders = activeOrders.filter(
    (wo) => isToday(new Date(wo.scheduledAt))
  );
  const weekOrders = activeOrders.filter(
    (wo) => isThisWeek(new Date(wo.scheduledAt))
  );
  const completedOrders = workOrders.filter((wo) => wo.status === 'fullfort');

  const tabs = [
    { id: 'idag', label: 'I dag', count: todayOrders.length },
    { id: 'uke', label: 'Denne uken', count: weekOrders.length },
    { id: 'alle', label: 'Alle', count: activeOrders.length },
    { id: 'fullfort', label: 'Fullført', count: completedOrders.length },
  ];

  const sortByTime = (orders: WorkOrder[]) =>
    [...orders].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const getFilteredOrders = () => {
    switch (tab) {
      case 'idag': return sortByTime(todayOrders);
      case 'uke': return sortByTime(weekOrders);
      case 'alle': return sortByTime(activeOrders);
      case 'fullfort': return sortByTime(completedOrders);
      default: return sortByTime(todayOrders);
    }
  };

  const filteredOrders = getFilteredOrders();

  // Route summary for today
  const todayTotalKm = todayOrders.reduce(
    (sum, wo) => sum + (wo.organization.distanceFromOfficeKm || 0), 0
  );
  const todayTotalMin = todayOrders.reduce(
    (sum, wo) => sum + (wo.organization.distanceFromOfficeMin || 0), 0
  );
  const todayTotalUnits = todayOrders.reduce(
    (sum, wo) => sum + wo.units.length, 0
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <h1 className="page-title mb-4">Mine oppdrag</h1>

      <Tabs tabs={tabs} activeTab={tab} onChange={setTab} className="mb-4" />

      {/* Route summary for today */}
      {tab === 'idag' && todayOrders.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Navigation className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600">Dagens rute</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold">{todayOrders.length}</p>
              <p className="text-xs text-gray-500">Oppdrag</p>
            </div>
            <div>
              <p className="text-lg font-bold">{todayTotalUnits}</p>
              <p className="text-xs text-gray-500">Enheter</p>
            </div>
            <div>
              <p className="text-lg font-bold">{Math.round(todayTotalKm)} km</p>
              <p className="text-xs text-gray-500">{todayTotalMin} min</p>
            </div>
          </div>
        </Card>
      )}

      {/* Work order list */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          title={tab === 'fullfort' ? 'Ingen fullførte oppdrag' : 'Ingen oppdrag'}
          description={
            tab === 'idag'
              ? 'Du har ingen oppdrag i dag'
              : tab === 'uke'
                ? 'Du har ingen oppdrag denne uken'
                : tab === 'alle'
                  ? 'Du har ingen aktive oppdrag'
                  : 'Ingen fullførte oppdrag ennå'
          }
        />
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((wo) => (
            <Card
              key={wo.id}
              hover
              padding="none"
              onClick={() => router.push(`/tekniker/oppdrag/${wo.id}`)}
              className={`border-l-4 ${statusBorderColors[wo.status] || 'border-l-gray-300'}`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold">{wo.organization.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge type="workOrder" status={wo.status} />
                    {wo.status !== 'fullfort' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(wo.id);
                        }}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatDate(wo.scheduledAt)} kl. {formatTime(wo.scheduledAt)}</span>
                    </div>
                    {wo.status !== 'fullfort' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingDateId === wo.id) {
                            setEditingDateId(null);
                          } else {
                            setEditingDateId(wo.id);
                            setNewDate('');
                            setNewTime('');
                          }
                        }}
                        className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {editingDateId === wo.id && (
                    <div className="mt-2 mb-2 p-3 bg-gray-50 rounded-xl space-y-3" onClick={(e) => e.stopPropagation()}>
                      <AvailableSlotPicker
                        userId={wo.technicianId}
                        onSelect={(date, time) => {
                          setNewDate(date);
                          setNewTime(time);
                        }}
                        selectedDate={newDate || null}
                        selectedTime={newTime || null}
                      />
                      {newDate && newTime && (
                        <div className="flex gap-2">
                          <Button size="sm" fullWidth onClick={() => handleSaveDate(wo.id)} isLoading={savingDate}>
                            Lagre ny tid
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingDateId(null); setNewDate(''); setNewTime(''); }}>
                            Avbryt
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{wo.organization.address}</span>
                  </div>
                  {wo.units.length > 0 && (
                    <div className="flex items-start gap-1.5 text-xs text-gray-500">
                      <Building2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>
                        {wo.units.map((u) =>
                          `${u.dwellingUnit.unitNumber}${u.dwellingUnit.residentName ? ` – ${u.dwellingUnit.residentName}` : ''}`
                        ).join(', ')}
                      </span>
                    </div>
                  )}
                  {wo.organization.distanceFromOfficeKm != null && wo.organization.distanceFromOfficeMin != null && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Navigation className="h-3.5 w-3.5" />
                      <span>
                        {formatDistance(wo.organization.distanceFromOfficeKm, wo.organization.distanceFromOfficeMin)}
                      </span>
                    </div>
                  )}
                </div>
                {(wo.notes || wo.techVisits?.some((tv) => tv.notes)) && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                    {wo.notes && (
                      <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg">
                        📝 {wo.notes}
                      </p>
                    )}
                    {wo.techVisits?.filter((tv) => tv.notes).map((tv, i) => (
                      <p key={i} className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg">
                        📝 {tv.notes}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {/* Delete confirmation modal */}
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
    </div>
  );
}
