'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Clock, Plus, Play, CheckCircle, Check,
  Phone, User, ChevronDown, ChevronUp, Wrench, MessageSquare,
} from 'lucide-react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import StatusBadge from '@/components/ui/status-badge';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import AvailableSlotPicker from '@/components/ui/available-slot-picker';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import { formatDate, formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface DwellingUnit {
  id: string;
  unitNumber: string;
  floor: number | null;
  residentName: string | null;
  residentPhone: string | null;
  residentEmail: string | null;
  visitStatus: string;
  orderType: string | null;
  product: string | null;
  price: number | null;
  paymentPlanMonths: number | null;
  paymentMethod: string | null;
  scheduledAt: string | null;
  technicianId: string | null;
  smsSent: boolean;
  notes: string | null;
}

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
    latitude: number | null;
    longitude: number | null;
  };
  appointment: {
    scheduledAt: string;
    endAt: string | null;
  } | null;
  user: { name: string };
  dwellingUnits: DwellingUnit[];
}

export default function FeltselgerBesokDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showBookTech, setShowBookTech] = useState(false);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  // Add unit form
  const [unitNumber, setUnitNumber] = useState('');
  const [unitFloor, setUnitFloor] = useState('');
  const [saving, setSaving] = useState(false);

  // Register unit form
  const [showRegister, setShowRegister] = useState(false);
  const [registerUnitId, setRegisterUnitId] = useState('');
  const [regResidentName, setRegResidentName] = useState('');
  const [regResidentPhone, setRegResidentPhone] = useState('');
  const [regResidentEmail, setRegResidentEmail] = useState('');
  const [regTechnicianId, setRegTechnicianId] = useState('');
  const [regScheduledDate, setRegScheduledDate] = useState<string | null>(null);
  const [regScheduledTime, setRegScheduledTime] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  // Book technician form
  const [techDate, setTechDate] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [teknikere, setTeknikere] = useState<{ id: string; name: string }[]>([]);
  const [bookingTech, setBookingTech] = useState(false);

  // Kartverket auto-fetch
  const [fetchingKartverket, setFetchingKartverket] = useState(false);

  const fetchVisit = useCallback(async () => {
    try {
      const res = await fetch(`/api/visits/${id}`);
      const data = await res.json();
      setVisit(data.visit || null);
    } catch {
      setVisit(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVisit();
  }, [fetchVisit]);

  const fetchKartverketUnits = async () => {
    if (!visit) return;
    setFetchingKartverket(true);
    try {
      const params = new URLSearchParams({ address: visit.organization.address });
      const res = await fetch(`/api/kartverket/units?${params.toString()}`);
      const data = await res.json();
      const units: { unitNumber: string; floor: number | null }[] = data.units || [];

      if (units.length === 0) {
        toast('Ingen enheter funnet via Kartverket', { icon: 'i' });
        return;
      }

      // Create each unit
      let created = 0;
      for (const unit of units) {
        try {
          await fetch('/api/units', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationId: visit.organization.id,
              visitId: visit.id,
              unitNumber: unit.unitNumber,
              floor: unit.floor,
            }),
          });
          created++;
        } catch {
          // skip duplicates
        }
      }

      if (created > 0) {
        toast.success(`${created} enheter hentet fra Kartverket`);
        fetchVisit();
      }
    } catch {
      toast.error('Kunne ikke hente enheter fra Kartverket');
    } finally {
      setFetchingKartverket(false);
    }
  };

  const handleStartVisit = async () => {
    try {
      await fetch(`/api/visits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pagaar' }),
      });
      toast.success('Besøk startet');
      await fetchVisit();

      // Auto-fetch units from Kartverket if none exist
      if (visit && visit.dwellingUnits.length === 0) {
        fetchKartverketUnits();
      }
    } catch {
      toast.error('Kunne ikke starte besøk');
    }
  };

  const handleCompleteVisit = async () => {
    try {
      await fetch(`/api/visits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'fullfort' }),
      });
      toast.success('Besøk fullført');
      fetchVisit();
    } catch {
      toast.error('Kunne ikke fullføre besøk');
    }
  };

  const handleAddUnit = async () => {
    if (!unitNumber.trim() || !visit) return;
    setSaving(true);
    try {
      await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: visit.organization.id,
          visitId: visit.id,
          unitNumber: unitNumber.trim(),
          floor: unitFloor ? parseInt(unitFloor) : undefined,
        }),
      });
      toast.success('Enhet lagt til');
      setShowAddUnit(false);
      setUnitNumber('');
      setUnitFloor('');
      fetchVisit();
    } catch {
      toast.error('Kunne ikke legge til enhet');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUnitStatus = async (unitId: string, visitStatus: string) => {
    try {
      await fetch(`/api/units/${unitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitStatus }),
      });
      toast.success('Status oppdatert');
      fetchVisit();
    } catch {
      toast.error('Kunne ikke oppdatere status');
    }
  };

  const openRegisterModal = (unit: DwellingUnit) => {
    setRegisterUnitId(unit.id);
    setRegResidentName(unit.residentName || '');
    setRegResidentPhone(unit.residentPhone || '');
    setRegResidentEmail(unit.residentEmail || '');
    setRegTechnicianId(unit.technicianId || '');
    setRegScheduledDate(unit.scheduledAt ? unit.scheduledAt.split('T')[0] : null);
    setRegScheduledTime(unit.scheduledAt ? unit.scheduledAt.split('T')[1]?.slice(0, 5) : null);
    // Fetch technicians for the picker
    fetchTeknikere();
    setShowRegister(true);
  };

  const handleRegisterUnit = async () => {
    if (!regResidentName.trim()) {
      toast.error('Fyll inn beboernavn');
      return;
    }
    if (!regResidentPhone.trim()) {
      toast.error('Fyll inn telefonnummer');
      return;
    }
    if (!regTechnicianId) {
      toast.error('Velg tekniker');
      return;
    }
    if (!regScheduledDate || !regScheduledTime) {
      toast.error('Velg tidspunkt');
      return;
    }
    setRegistering(true);
    try {
      const scheduledAt = `${regScheduledDate}T${regScheduledTime}:00`;

      // 1. Update unit with contact info + scheduling, status → besok_booket
      const unitRes = await fetch(`/api/units/${registerUnitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentName: regResidentName.trim(),
          residentPhone: regResidentPhone.trim(),
          residentEmail: regResidentEmail.trim() || null,
          visitStatus: 'besok_booket',
          scheduledAt,
          technicianId: regTechnicianId,
          smsSent: true,
        }),
      });
      if (!unitRes.ok) {
        const err = await unitRes.json().catch(() => ({}));
        throw new Error(err.error || 'Kunne ikke oppdatere enhet');
      }

      // 2. Send SMS to customer from system
      const name = regResidentName.trim().split(' ')[0];
      const d = new Date(regScheduledDate + 'T12:00:00');
      const dateStr = d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' });
      const smsMessage = `Hei ${name}! Du har fått en avtale for ventilasjonsrens ${dateStr} kl ${regScheduledTime}. Bekreft med å svare JA. Mvh Konvoi`;

      await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: regResidentPhone.trim(),
          message: smsMessage,
        }),
      });

      // 3. Create work order for technician
      const woRes = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: visit!.organization.id,
          technicianId: regTechnicianId,
          scheduledAt,
          unitIds: [registerUnitId],
        }),
      });
      if (!woRes.ok) {
        const err = await woRes.json().catch(() => ({}));
        console.warn('Work order feil:', err.error);
      }

      toast.success('Kunde registrert og tekniker booket');
      setShowRegister(false);
      fetchVisit();
    } catch (err: any) {
      toast.error(err.message || 'Kunne ikke registrere kunde');
    } finally {
      setRegistering(false);
    }
  };

  const fetchTeknikere = async () => {
    try {
      const res = await fetch('/api/users?role=TEKNIKER');
      const data = await res.json();
      setTeknikere((data.users || []).map((u: any) => ({ id: u.id, name: u.name })));
    } catch {
      setTeknikere([]);
    }
  };

  const handleBookTechnician = async () => {
    if (!techDate || !visit || !technicianId) return;
    setBookingTech(true);
    try {
      const soldUnits = visit.dwellingUnits.filter((u) => u.visitStatus === 'besok_booket' || u.visitStatus === 'solgt');
      await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: visit.organization.id,
          technicianId,
          scheduledAt: techDate,
          unitIds: soldUnits.map((u) => u.id),
        }),
      });
      toast.success('Tekniker bestilt');
      setShowBookTech(false);
      setTechDate('');
      setTechnicianId('');
    } catch {
      toast.error('Kunne ikke bestille tekniker');
    } finally {
      setBookingTech(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!visit) return <EmptyState title="Besøk ikke funnet" description="Kunne ikke finne dette besøket" />;

  const bookedCount = visit.dwellingUnits.filter((u) => u.visitStatus === 'besok_booket').length;
  const visitedCount = visit.dwellingUnits.filter((u) => u.visitStatus !== 'ikke_besokt').length;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{visit.organization.name}</h1>
          <p className="text-xs text-gray-500">{visit.organization.address}</p>
        </div>
        <StatusBadge type="visit" status={visit.status} size="md" />
      </div>

      {/* Info row */}
      <Card className="mb-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold">{visitedCount}/{visit.dwellingUnits.length}</p>
            <p className="text-xs text-gray-500">Besøkt</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-600">{bookedCount}</p>
            <p className="text-xs text-gray-500">Booket</p>
          </div>
          <div>
            <p className="text-lg font-bold">{visit.organization.numUnits}</p>
            <p className="text-xs text-gray-500">I sameiet</p>
          </div>
        </div>
      </Card>

      {/* Appointment info */}
      {visit.appointment && (
        <Card className="mb-4">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>
              {formatDate(visit.appointment.scheduledAt)} kl. {formatTime(visit.appointment.scheduledAt)}
              {visit.appointment.endAt && ` - ${formatTime(visit.appointment.endAt)}`}
            </span>
          </div>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        {visit.status === 'planlagt' && (
          <Button fullWidth onClick={handleStartVisit}>
            <Play className="h-4 w-4" />
            Start besøk
          </Button>
        )}
        {visit.status === 'pagaar' && (
          <>
            <Button fullWidth variant="secondary" onClick={() => setShowAddUnit(true)}>
              <Plus className="h-4 w-4" />
              Legg til enhet
            </Button>
            <Button fullWidth onClick={handleCompleteVisit}>
              <CheckCircle className="h-4 w-4" />
              Fullfør besøk
            </Button>
          </>
        )}
        {visit.status === 'fullfort' && bookedCount > 0 && (
          <Button fullWidth onClick={() => { fetchTeknikere(); setShowBookTech(true); }}>
            <Wrench className="h-4 w-4" />
            Bestill tekniker
          </Button>
        )}
      </div>

      {/* Dwelling units */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Enheter ({visit.dwellingUnits.length})</h2>
        {visit.status === 'pagaar' && (
          <button
            onClick={() => setShowAddUnit(true)}
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            + Legg til
          </button>
        )}
      </div>

      {fetchingKartverket && (
        <Card className="mb-4">
          <div className="flex items-center gap-3 py-2">
            <LoadingSpinner />
            <p className="text-sm text-gray-600">Henter enheter fra Kartverket...</p>
          </div>
        </Card>
      )}

      {visit.dwellingUnits.length === 0 && !fetchingKartverket ? (
        <EmptyState
          title="Ingen enheter"
          description="Legg til enheter manuelt eller hent fra Kartverket"
          action={
            visit.status === 'pagaar' ? (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={fetchKartverketUnits}>
                  Hent fra Kartverket
                </Button>
                <Button size="sm" onClick={() => setShowAddUnit(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Legg til manuelt
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {visit.dwellingUnits.map((unit) => (
            <Card key={unit.id} padding="sm">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedUnit(expandedUnit === unit.id ? null : unit.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold">
                    {unit.unitNumber}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {unit.residentName || `Enhet ${unit.unitNumber}`}
                    </p>
                    {unit.visitStatus === 'besok_booket' && unit.scheduledAt ? (
                      <p className="text-xs text-green-600">
                        <Check className="h-3 w-3 inline mr-0.5" />
                        Booket {formatDate(unit.scheduledAt)} kl. {formatTime(unit.scheduledAt)}
                      </p>
                    ) : unit.floor != null ? (
                      <p className="text-xs text-gray-400">{unit.floor}. etasje</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge type="dwelling" status={unit.visitStatus} />
                  {expandedUnit === unit.id ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              {expandedUnit === unit.id && visit.status === 'pagaar' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {unit.residentName && (
                    <p className="text-xs text-gray-600 mb-1">
                      <User className="h-3.5 w-3.5 inline mr-1" />
                      {unit.residentName}
                    </p>
                  )}
                  {unit.residentPhone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      <Phone className="h-3.5 w-3.5" />
                      <a href={`tel:${unit.residentPhone}`} className="underline">{unit.residentPhone}</a>
                    </div>
                  )}
                  {(unit.visitStatus === 'besok_booket' || unit.visitStatus === 'solgt') && unit.scheduledAt && (
                    <div className="bg-green-50 rounded-lg p-2 mb-2 text-xs">
                      <span className="font-medium">
                        <Clock className="h-3.5 w-3.5 inline mr-1" />
                        Avtale: {formatDate(unit.scheduledAt)} kl. {formatTime(unit.scheduledAt)}
                      </span>
                    </div>
                  )}
                  {unit.notes && (
                    <p className="text-xs text-gray-500 mb-3">{unit.notes}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={unit.visitStatus === 'besok_booket' ? 'primary' : 'secondary'}
                      onClick={() => openRegisterModal(unit)}
                    >
                      <User className="h-3.5 w-3.5" />
                      {unit.visitStatus === 'besok_booket' ? 'Endre' : 'Registrer kunde'}
                    </Button>
                    <Button
                      size="sm"
                      variant={unit.visitStatus === 'ikke_interessert' ? 'danger' : 'secondary'}
                      onClick={() => handleUpdateUnitStatus(unit.id, 'ikke_interessert')}
                    >
                      Nei
                    </Button>
                    <Button
                      size="sm"
                      variant={unit.visitStatus === 'ikke_hjemme' ? 'secondary' : 'ghost'}
                      onClick={() => handleUpdateUnitStatus(unit.id, 'ikke_hjemme')}
                    >
                      Ikke hjemme
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add unit modal */}
      <Modal isOpen={showAddUnit} onClose={() => setShowAddUnit(false)} title="Legg til enhet">
        <div className="space-y-4">
          <Input
            label="Enhetsnummer"
            placeholder="F.eks. 101, H0201"
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
          />
          <Input
            label="Etasje (valgfritt)"
            type="number"
            placeholder="F.eks. 1, 2, 3"
            value={unitFloor}
            onChange={(e) => setUnitFloor(e.target.value)}
          />
          <Button fullWidth onClick={handleAddUnit} isLoading={saving}>
            Legg til
          </Button>
        </div>
      </Modal>

      {/* Register unit modal */}
      <Modal isOpen={showRegister} onClose={() => setShowRegister(false)} title="Registrer kunde" size="lg">
        <div className="space-y-4">
          <Input
            label="Beboernavn *"
            placeholder="Navn"
            value={regResidentName}
            onChange={(e) => setRegResidentName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Telefon *"
              type="tel"
              placeholder="Telefonnummer"
              value={regResidentPhone}
              onChange={(e) => setRegResidentPhone(e.target.value)}
            />
            <Input
              label="E-post"
              type="email"
              placeholder="E-post"
              value={regResidentEmail}
              onChange={(e) => setRegResidentEmail(e.target.value)}
            />
          </div>

          {/* Technician selector */}
          <div>
            <label className="label">Tekniker</label>
            <select
              value={regTechnicianId}
              onChange={(e) => setRegTechnicianId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Velg tekniker</option>
              {teknikere.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Available time slots */}
          {regTechnicianId ? (
            <AvailableSlotPicker
              userId={regTechnicianId}
              onSelect={(date, time) => {
                setRegScheduledDate(date);
                setRegScheduledTime(time);
              }}
              selectedDate={regScheduledDate}
              selectedTime={regScheduledTime}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Velg tekniker for å se ledige tider
            </p>
          )}

          <Button fullWidth onClick={handleRegisterUnit} isLoading={registering}>
            <MessageSquare className="h-4 w-4" />
            Registrer kunde
          </Button>
        </div>
      </Modal>

      {/* Book technician modal */}
      <Modal isOpen={showBookTech} onClose={() => setShowBookTech(false)} title="Bestill tekniker">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {bookedCount} enheter er booket og klare for rens.
          </p>
          <div>
            <label className="label">Tekniker</label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Velg tekniker</option>
              {teknikere.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          {technicianId ? (
            <AvailableSlotPicker
              userId={technicianId}
              onSelect={(date, time) => setTechDate(`${date}T${time}:00`)}
              selectedDate={techDate ? techDate.split('T')[0] : null}
              selectedTime={techDate ? techDate.split('T')[1]?.slice(0, 5) : null}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Velg tekniker for å se ledige tider
            </p>
          )}
          <Button fullWidth onClick={handleBookTechnician} isLoading={bookingTech} disabled={!technicianId || !techDate}>
            <Wrench className="h-4 w-4" />
            Bestill tekniker
          </Button>
        </div>
      </Modal>
    </div>
  );
}
