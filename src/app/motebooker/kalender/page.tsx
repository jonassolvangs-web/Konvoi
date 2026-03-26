'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Clock, Users, Plus, ChevronRight, Trash2, Wrench } from 'lucide-react';
import { addDays, startOfWeek, isSameDay, isSameWeek, differenceInMinutes } from 'date-fns';
import Calendar from '@/components/ui/calendar';
import Card from '@/components/ui/card';
import ToggleTabs from '@/components/ui/toggle-tabs';
import StatusBadge from '@/components/ui/status-badge';
import EmptyState from '@/components/ui/empty-state';
import LoadingSpinner from '@/components/ui/loading-spinner';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import { cn, formatTime, formatDateLong, formatDayName, formatDateShort } from '@/lib/utils';
import { toDateString } from '@/lib/availability';
import toast from 'react-hot-toast';

interface WorkOrder {
  id: string;
  scheduledAt: string;
  status: string;
  notes: string | null;
  organization: {
    id: string;
    name: string;
    address: string;
    postalCode: string | null;
    city: string | null;
    numUnits: number | null;
  };
  technician: {
    name: string;
  };
  units: { id: string }[];
}

interface Technician {
  id: string;
  name: string;
}

const VIEW_TABS = [
  { id: 'dag', label: 'Dag' },
  { id: 'uke', label: 'Uke' },
  { id: 'maned', label: 'Måned' },
];

const TIMELINE_HOURS = Array.from({ length: 12 }, (_, i) => 7 + i);

function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

const DAYS_SHORT = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'];

const PRODUCTS: Record<string, { name: string; price: number }[]> = {
  ventilasjonsrens: [
    { name: 'Standard', price: 3990 },
    { name: 'Medium', price: 4990 },
    { name: 'Stor', price: 5990 },
  ],
  befaring: [
    { name: 'Befaring', price: 0 },
  ],
  service: [
    { name: 'Ny reim', price: 800 },
    { name: 'Filterbytte', price: 990 },
    { name: 'Service Standard', price: 1990 },
    { name: 'Service Pluss', price: 2990 },
  ],
};

export default function MotebookerKalenderPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('maned');

  // ── Add modal state ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    technicianId: '',
    customerName: '',
    address: '',
    postalCode: '',
    city: '',
    phone: '',
    email: '',
    date: '',
    time: '09:00',
    orderType: 'ventilasjonsrens',
    product: 'Standard',
    price: 3990,
    notes: '',
  });

  // ── Delete state ──
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchWorkOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/work-orders?all=true');
      const data = await res.json();
      setWorkOrders(data.workOrders || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Fetch technicians when modal opens
  useEffect(() => {
    if (showAddModal && technicians.length === 0) {
      fetch('/api/users?role=TEKNIKER')
        .then((r) => r.json())
        .then((data) => setTechnicians(data.users || []))
        .catch(() => {});
    }
  }, [showAddModal]);

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
  const dotDates = workOrders
    .filter((wo) => wo.status !== 'fullfort')
    .map((wo) => new Date(wo.scheduledAt));

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

  // Countdown text
  const getCountdown = (scheduledAt: string) => {
    const diff = differenceInMinutes(new Date(scheduledAt), now);
    if (diff < 0) return null;
    if (diff < 60) return { text: `om ${diff} min`, soon: true };
    const hrs = Math.floor(diff / 60);
    if (hrs < 24) return { text: `om ${hrs} time${hrs > 1 ? 'r' : ''}`, soon: hrs <= 2 };
    const days = Math.floor(diff / 1440);
    return { text: `om ${days} dag${days > 1 ? 'er' : ''}`, soon: false };
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
      fetchWorkOrders();
    } catch {
      toast.error('Kunne ikke slette oppdrag');
    } finally {
      setDeleting(false);
    }
  };

  // ── Add modal helpers ──
  const openAddModal = () => {
    setFormData({
      technicianId: '',
      customerName: '',
      address: '',
      postalCode: '',
      city: '',
      phone: '',
      email: '',
      date: toDateString(selectedDate),
      time: '09:00',
      orderType: 'ventilasjonsrens',
      product: 'Standard',
      price: 3990,
      notes: '',
    });
    setShowAddModal(true);
  };

  const updateForm = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOrderTypeChange = (type: string) => {
    const first = PRODUCTS[type]?.[0];
    setFormData((prev) => ({
      ...prev,
      orderType: type,
      product: first?.name || '',
      price: first?.price || 0,
    }));
  };

  const handleProductChange = (productName: string) => {
    const p = PRODUCTS[formData.orderType]?.find((x) => x.name === productName);
    setFormData((prev) => ({
      ...prev,
      product: productName,
      price: p?.price || prev.price,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.customerName || !formData.address || !formData.date) {
      toast.error('Fyll inn navn, adresse og dato');
      return;
    }

    setSaving(true);
    try {
      const scheduledAt = `${formData.date}T${formData.time}:00`;
      const res = await fetch('/api/work-orders/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicianId: formData.technicianId || undefined,
          customerName: formData.customerName,
          address: formData.address,
          postalCode: formData.postalCode || undefined,
          city: formData.city || undefined,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          scheduledAt,
          orderType: formData.orderType,
          product: formData.product,
          price: formData.price,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Feil');
      }

      toast.success('Oppdrag opprettet!');
      setShowAddModal(false);
      fetchWorkOrders();
    } catch (err: any) {
      toast.error(err.message || 'Kunne ikke opprette oppdrag');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-3">
        <h1 className="page-title">Kalender</h1>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-full hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Nytt oppdrag
        </button>
      </div>

      {/* ── Stats row ── */}
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

      {/* ── View toggle ── */}
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

          {/* Upcoming section */}
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
                            {formatTime(wo.scheduledAt)} · {wo.technician.name}
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
                      <OrderCard key={wo.id} wo={wo} onDelete={(id) => setDeleteId(id)} />
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
                      <OrderCard key={wo.id} wo={wo} onDelete={(id) => setDeleteId(id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {dayOrders.length === 0 && (
            <EmptyState
              title="Ingen oppdrag"
              description="Det er ingen oppdrag denne dagen"
            />
          )}
        </div>
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

      {/* ── Add appointment modal ── */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Nytt oppdrag">
        <div className="space-y-4">
          {/* Tekniker */}
          <div>
            <label className="label">Tekniker</label>
            <select
              value={formData.technicianId}
              onChange={(e) => updateForm('technicianId', e.target.value)}
              className="input-field"
            >
              <option value="">Velg tekniker (valgfritt)</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Kunde */}
          <Input
            label="Kundenavn *"
            value={formData.customerName}
            onChange={(e) => updateForm('customerName', e.target.value)}
            placeholder="Navn eller sameie"
          />

          <Input
            label="Adresse *"
            value={formData.address}
            onChange={(e) => updateForm('address', e.target.value)}
            placeholder="Gateadresse"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Postnr"
              value={formData.postalCode}
              onChange={(e) => updateForm('postalCode', e.target.value)}
              placeholder="0000"
            />
            <Input
              label="Sted"
              value={formData.city}
              onChange={(e) => updateForm('city', e.target.value)}
              placeholder="Oslo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Telefon"
              value={formData.phone}
              onChange={(e) => updateForm('phone', e.target.value)}
              placeholder="900 00 000"
              type="tel"
            />
            <Input
              label="E-post"
              value={formData.email}
              onChange={(e) => updateForm('email', e.target.value)}
              placeholder="epost@test.no"
              type="email"
            />
          </div>

          {/* Dato/tid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dato *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateForm('date', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Klokkeslett</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => updateForm('time', e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="label">Type oppdrag</label>
            <div className="flex gap-2 mt-1">
              {([
                { id: 'ventilasjonsrens', label: 'Rens' },
                { id: 'befaring', label: 'Befaring' },
                { id: 'service', label: 'Service' },
              ] as const).map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleOrderTypeChange(type.id)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                    formData.orderType === type.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Produkt */}
          <div>
            <label className="label">Produkt</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {PRODUCTS[formData.orderType]?.map((p) => (
                <button
                  key={p.name}
                  onClick={() => handleProductChange(p.name)}
                  className={cn(
                    'p-2.5 rounded-xl text-sm text-left transition-colors',
                    formData.product === p.name
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  )}
                >
                  <span className="font-medium block text-xs">{p.name}</span>
                  <span className="text-gray-500 text-xs">{p.price.toLocaleString('nb-NO')} kr</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)} fullWidth>
              Avbryt
            </Button>
            <Button onClick={handleSubmit} isLoading={saving} fullWidth>
              Opprett oppdrag
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Order card component ──
function OrderCard({ wo, onDelete }: { wo: WorkOrder; onDelete: (id: string) => void }) {
  const statusColor =
    wo.status === 'fullfort'
      ? 'border-l-green-500 opacity-70'
      : wo.status === 'pagaar'
        ? 'border-l-yellow-500'
        : 'border-l-blue-500';

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-xl p-3 transition-all hover:shadow-sm border-l-[3px]',
        statusColor
      )}
    >
      <div className="flex items-start justify-between mb-1">
        <span className="text-sm font-semibold">{wo.organization.name}</span>
        <div className="flex items-center gap-1.5">
          <StatusBadge type="workOrder" status={wo.status} />
          {wo.status === 'planlagt' && (
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
          <span>{wo.technician.name} · {wo.units.length} enheter</span>
        </div>
      </div>
    </div>
  );
}
