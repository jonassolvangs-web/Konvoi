'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Building2, Clock, Plus, Play, CheckCircle,
  Phone, User, ChevronDown, ChevronUp, Wrench, ShoppingCart,
} from 'lucide-react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import StatusBadge from '@/components/ui/status-badge';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils';
import { productsByOrderType, paymentPlanOptions } from '@/lib/constants';
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
  const [regOrderType, setRegOrderType] = useState('ventilasjonsrens');
  const [regProduct, setRegProduct] = useState('');
  const [regPrice, setRegPrice] = useState(0);
  const [regPaymentPlan, setRegPaymentPlan] = useState(1);
  const [regPaymentMethod, setRegPaymentMethod] = useState('vipps');
  const [registering, setRegistering] = useState(false);

  // Book technician form
  const [techDate, setTechDate] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [teknikere, setTeknikere] = useState<{ id: string; name: string }[]>([]);
  const [bookingTech, setBookingTech] = useState(false);

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

  const handleStartVisit = async () => {
    try {
      await fetch(`/api/visits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pagaar' }),
      });
      toast.success('Besøk startet');
      fetchVisit();
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
    setRegOrderType(unit.orderType || 'ventilasjonsrens');
    setRegProduct(unit.product || '');
    setRegPrice(unit.price || 0);
    setRegPaymentPlan(unit.paymentPlanMonths || 1);
    setRegPaymentMethod(unit.paymentMethod || 'vipps');
    // Auto-select first product if none selected
    const ot = unit.orderType || 'ventilasjonsrens';
    if (!unit.product && productsByOrderType[ot]?.length) {
      const p = productsByOrderType[ot][0];
      setRegProduct(p.name);
      setRegPrice(p.price);
    }
    setShowRegister(true);
  };

  const handleRegisterUnit = async () => {
    if (!regResidentName.trim()) {
      toast.error('Fyll inn beboernavn');
      return;
    }
    setRegistering(true);
    try {
      await fetch(`/api/units/${registerUnitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentName: regResidentName.trim(),
          residentPhone: regResidentPhone.trim() || null,
          residentEmail: regResidentEmail.trim() || null,
          visitStatus: 'solgt',
          orderType: regOrderType,
          product: regProduct,
          price: regPrice,
          paymentPlanMonths: regPaymentPlan > 1 ? regPaymentPlan : null,
          paymentMethod: regPaymentMethod,
          smsSent: true,
        }),
      });
      toast.success('Enhet registrert og SMS sendt');
      setShowRegister(false);
      fetchVisit();
    } catch {
      toast.error('Kunne ikke registrere enhet');
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
      const soldUnits = visit.dwellingUnits.filter((u) => u.visitStatus === 'solgt');
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

  const soldCount = visit.dwellingUnits.filter((u) => u.visitStatus === 'solgt').length;
  const visitedCount = visit.dwellingUnits.filter((u) => u.visitStatus !== 'ikke_besokt').length;
  const totalRevenue = visit.dwellingUnits
    .filter((u) => u.visitStatus === 'solgt')
    .reduce((sum, u) => sum + (u.price || 0), 0);

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
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-lg font-bold">{visitedCount}/{visit.dwellingUnits.length}</p>
            <p className="text-xs text-gray-500">Besøkt</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">{soldCount}</p>
            <p className="text-xs text-gray-500">Solgt</p>
          </div>
          <div>
            <p className="text-lg font-bold">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-gray-500">Total</p>
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
        {visit.status === 'fullfort' && soldCount > 0 && (
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

      {visit.dwellingUnits.length === 0 ? (
        <EmptyState
          title="Ingen enheter"
          description="Legg til enheter for å starte besøk"
          action={
            visit.status === 'pagaar' ? (
              <Button size="sm" onClick={() => setShowAddUnit(true)}>
                <Plus className="h-3.5 w-3.5" />
                Legg til enhet
              </Button>
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
                    {unit.floor != null && (
                      <p className="text-xs text-gray-400">{unit.floor}. etasje</p>
                    )}
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
                  {unit.visitStatus === 'solgt' && unit.product && (
                    <div className="bg-green-50 rounded-lg p-2 mb-2 text-xs">
                      <span className="font-medium">{unit.orderType === 'service' ? 'Service' : 'Ventilasjonsrens'}: {unit.product}</span>
                      <span className="float-right font-bold">{formatCurrency(unit.price || 0)}</span>
                      {unit.paymentPlanMonths && unit.paymentPlanMonths > 1 && (
                        <p className="text-gray-600 mt-0.5">
                          {formatCurrency(Math.ceil((unit.price || 0) / unit.paymentPlanMonths))}/mnd i {unit.paymentPlanMonths} mnd
                        </p>
                      )}
                      <p className="text-gray-500 mt-0.5">Betaling: {unit.paymentMethod === 'vipps' ? 'Vipps' : unit.paymentMethod === 'faktura' ? 'Faktura' : 'Kontant'}</p>
                    </div>
                  )}
                  {unit.notes && (
                    <p className="text-xs text-gray-500 mb-3">{unit.notes}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={unit.visitStatus === 'solgt' ? 'primary' : 'secondary'}
                      onClick={() => openRegisterModal(unit)}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      {unit.visitStatus === 'solgt' ? 'Endre' : 'Registrer salg'}
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
      <Modal isOpen={showRegister} onClose={() => setShowRegister(false)} title="Registrer enhet" size="lg">
        <div className="space-y-4">
          <Input
            label="Beboernavn *"
            placeholder="Navn"
            value={regResidentName}
            onChange={(e) => setRegResidentName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Telefon"
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

          {/* Order type */}
          <div>
            <label className="label">Ordretype</label>
            <div className="flex gap-2">
              {['ventilasjonsrens', 'service'].map((ot) => (
                <button
                  key={ot}
                  onClick={() => {
                    setRegOrderType(ot);
                    const products = productsByOrderType[ot] || [];
                    if (products.length) {
                      setRegProduct(products[0].name);
                      setRegPrice(products[0].price);
                    }
                  }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    regOrderType === ot
                      ? 'bg-black text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {ot === 'ventilasjonsrens' ? 'Ventilasjonsrens' : 'Service'}
                </button>
              ))}
            </div>
          </div>

          {/* Product selection */}
          <div>
            <label className="label">Produkt</label>
            <div className="grid grid-cols-3 gap-2">
              {(productsByOrderType[regOrderType] || []).map((p) => (
                <button
                  key={p.name}
                  onClick={() => { setRegProduct(p.name); setRegPrice(p.price); }}
                  className={`py-3 px-2 rounded-xl text-center transition-colors ${
                    regProduct === p.name
                      ? 'bg-black text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-sm font-medium block">{p.label}</span>
                  <span className="text-xs block mt-0.5">{formatCurrency(p.price)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payment plan */}
          <div>
            <label className="label">Betalingsplan</label>
            <div className="flex gap-2">
              {paymentPlanOptions.map((m) => (
                <button
                  key={m}
                  onClick={() => setRegPaymentPlan(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    regPaymentPlan === m
                      ? 'bg-black text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {m === 1 ? 'Fullt' : `${m} mnd`}
                </button>
              ))}
            </div>
            {regPaymentPlan > 1 && regPrice > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(Math.ceil(regPrice / regPaymentPlan))}/mnd i {regPaymentPlan} mnd
              </p>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className="label">Betalingsmåte</label>
            <div className="flex gap-2">
              {[
                { id: 'vipps', label: 'Vipps' },
                { id: 'faktura', label: 'Faktura' },
                { id: 'kontant', label: 'Kontant' },
              ].map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => setRegPaymentMethod(pm.id)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    regPaymentMethod === pm.id
                      ? 'bg-black text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex justify-between text-sm">
              <span>{regProduct || 'Velg produkt'}</span>
              <span className="font-bold">{formatCurrency(regPrice)}</span>
            </div>
          </div>

          <Button fullWidth onClick={handleRegisterUnit} isLoading={registering}>
            <CheckCircle className="h-4 w-4" />
            Registrer og send SMS
          </Button>
        </div>
      </Modal>

      {/* Book technician modal */}
      <Modal isOpen={showBookTech} onClose={() => setShowBookTech(false)} title="Bestill tekniker">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {soldCount} enheter er solgt og klare for rens. Total: {formatCurrency(totalRevenue)}
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
          <Input
            label="Ønsket dato og tid"
            type="datetime-local"
            value={techDate}
            onChange={(e) => setTechDate(e.target.value)}
          />
          <Button fullWidth onClick={handleBookTechnician} isLoading={bookingTech} disabled={!technicianId || !techDate}>
            <Wrench className="h-4 w-4" />
            Bestill tekniker
          </Button>
        </div>
      </Modal>
    </div>
  );
}
