'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Clock, Play, CheckCircle, Square, CheckSquare,
  Wind, CreditCard, PenTool, Building2, Trash2, Edit3,
} from 'lucide-react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import StatusBadge from '@/components/ui/status-badge';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import { formatDate, formatTime, formatCurrency, cn } from '@/lib/utils';
import { defaultChecklist, productsByOrderType, paymentPlanOptions } from '@/lib/constants';
import toast from 'react-hot-toast';

interface ChecklistItem {
  id: number;
  label: string;
  checked: boolean;
}

interface WorkOrderUnit {
  id: string;
  orderType: string;
  productName: string | null;
  price: number;
  paymentPlanMonths: number | null;
  checklist: ChecklistItem[];
  airBefore: number | null;
  airAfter: number | null;
  paymentMethod: string | null;
  paymentStatus: string;
  notes: string | null;
  originalOrderType: string | null;
  originalProduct: string | null;
  originalPrice: number | null;
  dwellingUnit: {
    id: string;
    unitNumber: string;
    floor: number | null;
    residentName: string | null;
    residentPhone: string | null;
  };
  product: {
    name: string;
    price: number;
  } | null;
}

interface WorkOrder {
  id: string;
  scheduledAt: string;
  status: string;
  completedAt: string | null;
  signatureUrl: string | null;
  organization: {
    id: string;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  technician: { name: string; email: string };
  units: WorkOrderUnit[];
}

export default function TeknikerOppdragDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeUnit, setActiveUnit] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Air measurement state
  const [airBefore, setAirBefore] = useState('');
  const [airAfter, setAirAfter] = useState('');

  // Filter subscription state
  const [showFilterSub, setShowFilterSub] = useState(false);
  const [filterSubUnitId, setFilterSubUnitId] = useState('');
  const [filterSubMonths, setFilterSubMonths] = useState(12);
  const [savingFilterSub, setSavingFilterSub] = useState(false);

  // Change order state
  const [showChangeOrder, setShowChangeOrder] = useState(false);
  const [changeUnitId, setChangeUnitId] = useState('');
  const [changeOrderType, setChangeOrderType] = useState('ventilasjonsrens');
  const [changeProduct, setChangeProduct] = useState('');
  const [changePrice, setChangePrice] = useState(0);
  const [changingOrder, setChangingOrder] = useState(false);
  const [changeOriginal, setChangeOriginal] = useState({ orderType: '', product: '', price: 0 });

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  const fetchWorkOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`);
      const data = await res.json();
      setWorkOrder(data.workOrder || null);
    } catch {
      setWorkOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWorkOrder();
  }, [fetchWorkOrder]);

  const handleStartOrder = async () => {
    try {
      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pagaar' }),
      });
      toast.success('Oppdrag startet');
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke starte oppdrag');
    }
  };

  const handleToggleChecklist = async (unitId: string, checklist: ChecklistItem[], itemId: number) => {
    const updated = checklist.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    try {
      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, checklist: updated }),
      });
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke oppdatere sjekkliste');
    }
  };

  const handleSaveAir = async (unitId: string) => {
    try {
      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          airBefore: airBefore ? parseFloat(airBefore) : null,
          airAfter: airAfter ? parseFloat(airAfter) : null,
        }),
      });
      toast.success('Målinger lagret');
      setAirBefore('');
      setAirAfter('');
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke lagre målinger');
    }
  };

  const handlePayment = async (unitId: string, paymentMethod: string) => {
    const statusMap: Record<string, string> = {
      vipps: 'vipps_sendt',
      faktura: 'faktura_sendt',
      kontant: 'betalt',
    };
    try {
      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          paymentMethod,
          paymentStatus: statusMap[paymentMethod] || 'vipps_sendt',
        }),
      });
      toast.success('Betaling registrert');
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke registrere betaling');
    }
  };

  const openChangeOrder = (unit: WorkOrderUnit) => {
    setChangeUnitId(unit.id);
    setChangeOrderType(unit.orderType);
    setChangeProduct(unit.productName || '');
    setChangePrice(unit.price);
    setChangeOriginal({
      orderType: unit.originalOrderType || unit.orderType,
      product: unit.originalProduct || unit.productName || '',
      price: unit.originalPrice ?? unit.price,
    });
    setShowChangeOrder(true);
  };

  const handleChangeOrder = async () => {
    setChangingOrder(true);
    try {
      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: changeUnitId,
          orderType: changeOrderType,
          productName: changeProduct,
          price: changePrice,
          originalOrderType: changeOriginal.orderType,
          originalProduct: changeOriginal.product,
          originalPrice: changeOriginal.price,
        }),
      });
      toast.success('Ordre endret');
      setShowChangeOrder(false);
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke endre ordre');
    } finally {
      setChangingOrder(false);
    }
  };

  const handleCompleteUnit = async (unitId: string) => {
    try {
      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          status: 'fullfort',
          completedAt: new Date().toISOString(),
        }),
      });
      toast.success('Enhet fullført');
      setFilterSubUnitId(unitId);
      setShowFilterSub(true);
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke fullføre enhet');
    }
  };

  const handleCreateFilterSub = async () => {
    if (!workOrder) return;
    setSavingFilterSub(true);
    const priceMap: Record<number, number> = { 6: 149, 12: 129 };
    try {
      await fetch('/api/filter-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dwellingUnitId: filterSubUnitId,
          organizationId: workOrder.organization.id,
          months: filterSubMonths,
          pricePerMonth: priceMap[filterSubMonths] || 129,
        }),
      });
      toast.success('Filteravtale opprettet');
      setShowFilterSub(false);
    } catch {
      toast.error('Kunne ikke opprette filteravtale');
    } finally {
      setSavingFilterSub(false);
    }
  };

  // Signature canvas handlers
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  useEffect(() => {
    if (showSignature) {
      setTimeout(initCanvas, 100);
    }
  }, [showSignature, initCanvas]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    isDrawingRef.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      let signatureUrl = null;
      if (canvasRef.current) {
        signatureUrl = canvasRef.current.toDataURL('image/png');
      }
      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'fullfort', signatureUrl }),
      });
      toast.success('Oppdrag fullført!');
      setShowSignature(false);
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke fullføre oppdrag');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!workOrder) return <EmptyState title="Oppdrag ikke funnet" description="Kunne ikke finne dette oppdraget" />;

  const totalPrice = workOrder.units.reduce((sum, u) => sum + u.price, 0);
  const completedChecks = workOrder.units.reduce((sum, u) => {
    const cl = (u.checklist || []) as ChecklistItem[];
    return sum + cl.filter((i) => i.checked).length;
  }, 0);
  const totalChecks = workOrder.units.reduce((sum, u) => {
    const cl = (u.checklist || []) as ChecklistItem[];
    return sum + cl.length;
  }, 0);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{workOrder.organization.name}</h1>
          <p className="text-xs text-gray-500">{workOrder.organization.address}</p>
        </div>
        <StatusBadge type="workOrder" status={workOrder.status} size="md" />
      </div>

      {/* Info cards */}
      <Card className="mb-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold">{workOrder.units.length}</p>
            <p className="text-xs text-gray-500">Enheter</p>
          </div>
          <div>
            <p className="text-lg font-bold">{completedChecks}/{totalChecks}</p>
            <p className="text-xs text-gray-500">Sjekkliste</p>
          </div>
          <div>
            <p className="text-lg font-bold">{formatCurrency(totalPrice)}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>
      </Card>

      {/* Schedule info */}
      <Card className="mb-4">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          <span>{formatDate(workOrder.scheduledAt)} kl. {formatTime(workOrder.scheduledAt)}</span>
        </div>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        {workOrder.status === 'planlagt' && (
          <Button fullWidth onClick={handleStartOrder}>
            <Play className="h-4 w-4" />
            Start oppdrag
          </Button>
        )}
        {workOrder.status === 'pagaar' && (
          <Button fullWidth onClick={() => setShowSignature(true)}>
            <CheckCircle className="h-4 w-4" />
            Fullfør oppdrag
          </Button>
        )}
      </div>

      {/* Units */}
      <h2 className="text-sm font-semibold mb-3">Enheter ({workOrder.units.length})</h2>
      <div className="space-y-3">
        {workOrder.units.map((unit) => {
          const isActive = activeUnit === unit.id;
          const checklist = (unit.checklist || []) as ChecklistItem[];
          const checked = checklist.filter((i) => i.checked).length;

          return (
            <Card key={unit.id} padding="none">
              {/* Unit header */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => setActiveUnit(isActive ? null : unit.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold">
                      {unit.dwellingUnit.unitNumber}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {unit.dwellingUnit.residentName || `Enhet ${unit.dwellingUnit.unitNumber}`}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {unit.productName || unit.product?.name || unit.orderType}
                        </span>
                        <span className="text-xs font-medium">{formatCurrency(unit.price)}</span>
                        {unit.paymentPlanMonths && unit.paymentPlanMonths > 1 && (
                          <span className="text-[10px] text-gray-400">
                            ({unit.paymentPlanMonths} mnd)
                          </span>
                        )}
                      </div>
                      {unit.originalPrice != null && unit.originalPrice !== unit.price && (
                        <p className="text-[10px] text-orange-500">
                          Endret fra {unit.originalProduct} {formatCurrency(unit.originalPrice)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      color={checked === checklist.length && checklist.length > 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                      }
                    >
                      {checked}/{checklist.length}
                    </Badge>
                    <StatusBadge type="payment" status={unit.paymentStatus} />
                  </div>
                </div>
              </div>

              {/* Expanded content */}
              {isActive && workOrder.status === 'pagaar' && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  {/* Checklist */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      <CheckSquare className="h-3.5 w-3.5 inline mr-1" />
                      Sjekkliste
                    </h4>
                    <div className="space-y-1.5">
                      {checklist.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleToggleChecklist(unit.id, checklist, item.id)}
                          className="flex items-center gap-2 w-full text-left py-1"
                        >
                          {item.checked ? (
                            <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-300 flex-shrink-0" />
                          )}
                          <span className={cn(
                            'text-sm',
                            item.checked && 'text-gray-400 line-through'
                          )}>
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Air measurements */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      <Wind className="h-3.5 w-3.5 inline mr-1" />
                      Luftmålinger
                    </h4>
                    <div className="flex gap-2 items-end">
                      <Input
                        label="For (l/s)"
                        type="number"
                        placeholder={unit.airBefore?.toString() || '0'}
                        value={airBefore}
                        onChange={(e) => setAirBefore(e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        label="Etter (l/s)"
                        type="number"
                        placeholder={unit.airAfter?.toString() || '0'}
                        value={airAfter}
                        onChange={(e) => setAirAfter(e.target.value)}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => handleSaveAir(unit.id)}>
                        Lagre
                      </Button>
                    </div>
                    {unit.airBefore != null && unit.airAfter != null && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          For: {unit.airBefore} l/s | Etter: {unit.airAfter} l/s
                        </span>
                        {unit.airAfter > unit.airBefore && (
                          <Badge color="bg-green-100 text-green-700" size="sm">
                            +{Math.round(((unit.airAfter - unit.airBefore) / unit.airBefore) * 100)}%
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Change order */}
                  <div>
                    <Button size="sm" variant="secondary" onClick={() => openChangeOrder(unit)}>
                      <Edit3 className="h-3.5 w-3.5" />
                      Endre ordre
                    </Button>
                  </div>

                  {/* Payment */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      <CreditCard className="h-3.5 w-3.5 inline mr-1" />
                      Betaling - {formatCurrency(unit.price)}
                      {unit.paymentPlanMonths && unit.paymentPlanMonths > 1 && (
                        <span className="normal-case font-normal"> ({formatCurrency(Math.ceil(unit.price / unit.paymentPlanMonths))}/mnd × {unit.paymentPlanMonths})</span>
                      )}
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={unit.paymentMethod === 'vipps' ? 'primary' : 'secondary'}
                        onClick={() => handlePayment(unit.id, 'vipps')}
                      >
                        Vipps
                      </Button>
                      <Button
                        size="sm"
                        variant={unit.paymentMethod === 'faktura' ? 'primary' : 'secondary'}
                        onClick={() => handlePayment(unit.id, 'faktura')}
                      >
                        Faktura
                      </Button>
                      <Button
                        size="sm"
                        variant={unit.paymentMethod === 'kontant' ? 'primary' : 'secondary'}
                        onClick={() => handlePayment(unit.id, 'kontant')}
                      >
                        Kontant
                      </Button>
                    </div>
                  </div>

                  {/* Complete unit */}
                  <div className="pt-2 border-t border-gray-100">
                    <Button
                      size="sm"
                      fullWidth
                      onClick={() => handleCompleteUnit(unit.id)}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Fullfør enhet
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Filter subscription modal */}
      <Modal isOpen={showFilterSub} onClose={() => setShowFilterSub(false)} title="Tilby filteravtale?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Vil du tilby filterabonnement til denne enheten?
          </p>
          <div className="flex gap-2">
            {[6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setFilterSubMonths(m)}
                className={`flex-1 py-3 rounded-xl text-center transition-colors ${
                  filterSubMonths === m
                    ? 'bg-black text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-sm font-medium block">{m} mnd</span>
                <span className="text-xs block mt-0.5">{m === 6 ? '149' : '129'} kr/mnd</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setShowFilterSub(false)}>
              Hopp over
            </Button>
            <Button fullWidth onClick={handleCreateFilterSub} isLoading={savingFilterSub}>
              Opprett avtale
            </Button>
          </div>
        </div>
      </Modal>

      {/* Change order modal */}
      <Modal isOpen={showChangeOrder} onClose={() => setShowChangeOrder(false)} title="Endre ordre">
        <div className="space-y-4">
          {changeOriginal.product && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="text-gray-500">Opprinnelig: {changeOriginal.product} {formatCurrency(changeOriginal.price)}</p>
            </div>
          )}

          <div>
            <label className="label">Ordretype</label>
            <div className="flex gap-2">
              {['ventilasjonsrens', 'service'].map((ot) => (
                <button
                  key={ot}
                  onClick={() => {
                    setChangeOrderType(ot);
                    const products = productsByOrderType[ot] || [];
                    if (products.length) {
                      setChangeProduct(products[0].name);
                      setChangePrice(products[0].price);
                    }
                  }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    changeOrderType === ot ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {ot === 'ventilasjonsrens' ? 'Ventilasjonsrens' : 'Service'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Produkt</label>
            <div className="grid grid-cols-3 gap-2">
              {(productsByOrderType[changeOrderType] || []).map((p) => (
                <button
                  key={p.name}
                  onClick={() => { setChangeProduct(p.name); setChangePrice(p.price); }}
                  className={`py-3 px-2 rounded-xl text-center transition-colors ${
                    changeProduct === p.name ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-sm font-medium block">{p.label}</span>
                  <span className="text-xs block mt-0.5">{formatCurrency(p.price)}</span>
                </button>
              ))}
            </div>
          </div>

          {changeOriginal.price !== changePrice && (
            <div className="bg-orange-50 rounded-xl p-3 text-sm">
              <p>Opprinnelig: {changeOriginal.product} {formatCurrency(changeOriginal.price)}</p>
              <p className="font-medium">Ny: {changeProduct} {formatCurrency(changePrice)}</p>
            </div>
          )}

          <Button fullWidth onClick={handleChangeOrder} isLoading={changingOrder}>
            Bekreft endring
          </Button>
        </div>
      </Modal>

      {/* Signature modal */}
      <Modal isOpen={showSignature} onClose={() => setShowSignature(false)} title="Signatur og fullføring" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Sameiet signerer for å bekrefte at arbeidet er utført.
          </p>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-48 bg-gray-50 touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={clearCanvas}>
              <Trash2 className="h-4 w-4" />
              Slett
            </Button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Totalt</span>
              <span className="text-lg font-bold">{formatCurrency(totalPrice)}</span>
            </div>
            <Button fullWidth onClick={handleComplete} isLoading={completing}>
              <CheckCircle className="h-4 w-4" />
              Fullfør oppdrag
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
