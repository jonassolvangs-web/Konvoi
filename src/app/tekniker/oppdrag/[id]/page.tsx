'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Clock, Play, CheckCircle, Square, CheckSquare,
  Wind, CreditCard, PenTool, Building2, Trash2, Edit3, Camera, Send,
  Image as ImageIcon, XCircle,
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

function parseChecklist(raw: any): ChecklistItem[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
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
  photoBeforeUrl: string | null;
  photoAfterUrl: string | null;
  reportSentAt: string | null;
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
    residentEmail: string | null;
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
    chairmanEmail: string | null;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Air measurement state
  const [airBefore, setAirBefore] = useState('');
  const [airAfter, setAirAfter] = useState('');

  // Change order state
  const [showChangeOrder, setShowChangeOrder] = useState(false);
  const [changeUnitId, setChangeUnitId] = useState('');
  const [changeOrderType, setChangeOrderType] = useState('ventilasjonsrens');
  const [changeProduct, setChangeProduct] = useState('');
  const [changePrice, setChangePrice] = useState(0);
  const [changingOrder, setChangingOrder] = useState(false);
  const [changeOriginal, setChangeOriginal] = useState({ orderType: '', product: '', price: 0 });
  const [changePaymentPlan, setChangePaymentPlan] = useState(0);
  const [changePaymentMethod, setChangePaymentMethod] = useState('faktura');

  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null); // 'before-{unitId}' | 'after-{unitId}'
  const [sendingReport, setSendingReport] = useState<string | null>(null); // unitId
  const [manualEmails, setManualEmails] = useState<Record<string, string>>({}); // unitId -> email

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

  const handleDeleteOrder = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/work-orders/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Oppdrag slettet');
      router.push('/tekniker/oppdrag');
    } catch {
      toast.error('Kunne ikke slette oppdrag');
    } finally {
      setDeleting(false);
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
    setChangePaymentPlan(unit.paymentPlanMonths || 0);
    setChangePaymentMethod(unit.paymentMethod || 'faktura');
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
      const statusMap: Record<string, string> = {
        vipps: 'vipps_sendt',
        faktura: 'faktura_sendt',
        kontant: 'betalt',
      };
      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: changeUnitId,
          orderType: changeOrderType,
          productName: changeProduct,
          price: changePrice,
          paymentPlanMonths: changePaymentPlan || null,
          paymentMethod: changePaymentMethod,
          paymentStatus: statusMap[changePaymentMethod] || 'ikke_betalt',
          originalOrderType: changeOriginal.orderType,
          originalProduct: changeOriginal.product,
          originalPrice: changeOriginal.price,
        }),
      });
      toast.success('Produkt bekreftet');
      setShowChangeOrder(false);
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke bekrefte produkt');
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
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke fullføre enhet');
    }
  };

  const compressImage = (file: File, maxSize = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Kunne ikke lese bildet'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Kunne ikke lese filen'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (unitId: string, type: 'before' | 'after', file: File) => {
    const key = `${type}-${unitId}`;
    setUploadingPhoto(key);
    try {
      const dataUri = await compressImage(file);

      const res = await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          [type === 'before' ? 'photoBeforeUrl' : 'photoAfterUrl']: dataUri,
        }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      toast.success(`${type === 'before' ? 'Før' : 'Etter'}-bilde lastet opp`);
      fetchWorkOrder();
    } catch (err: any) {
      toast.error(err.message || 'Kunne ikke laste opp bilde');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const getUnitEmail = (unit: WorkOrderUnit) => {
    return unit.dwellingUnit.residentEmail || workOrder?.organization.chairmanEmail || null;
  };

  const generatePdfInBrowser = async (htmlContent: string): Promise<string> => {
    const html2pdf = (await import('html2pdf.js')).default;

    // Extract body content from full HTML document
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyStyles = htmlContent.match(/<body([^>]*)>/i);
    const innerHtml = bodyMatch ? bodyMatch[1] : htmlContent;

    const container = document.createElement('div');
    // Apply body styles to container
    const styleMatch = bodyStyles?.[1]?.match(/style="([^"]*)"/);
    if (styleMatch) container.setAttribute('style', styleMatch[1]);
    // Position in viewport but invisible - html2canvas needs elements in the layout flow
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '700px';
    container.style.zIndex = '-9999';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    container.innerHTML = innerHtml;
    document.body.appendChild(container);

    // Wait for images to load and browser to paint
    await new Promise<void>((resolve) => {
      const images = container.querySelectorAll('img');
      if (images.length === 0) {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        return;
      }
      let loaded = 0;
      const checkDone = () => { if (++loaded >= images.length) resolve(); };
      images.forEach((img) => {
        if (img.complete) checkDone();
        else { img.onload = checkDone; img.onerror = checkDone; }
      });
      setTimeout(resolve, 5000); // fallback timeout
    });

    try {
      const dataUri: string = await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: 'rapport.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 700 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(container)
        .output('datauristring');

      return dataUri.split(',')[1];
    } finally {
      document.body.removeChild(container);
    }
  };

  const handleSendReport = async (unit: WorkOrderUnit) => {
    const email = getUnitEmail(unit) || manualEmails[unit.id]?.trim();
    if (!email) {
      toast.error('Legg inn e-postadresse først');
      return;
    }

    setSendingReport(unit.id);
    try {
      if (!workOrder) return;

      // Save manually entered email to dwelling unit
      if (!getUnitEmail(unit) && manualEmails[unit.id]?.trim()) {
        await fetch(`/api/work-orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dwellingUnitId: unit.dwellingUnit.id,
            residentEmail: manualEmails[unit.id].trim(),
          }),
        });
      }

      const { generateReportHtml, generateGreetingHtml } = await import('@/lib/report');
      const baseUrl = window.location.origin;
      const completedDate = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
      const reportHtml = generateReportHtml({
        organizationName: workOrder.organization.name,
        organizationAddress: workOrder.organization.address,
        technicianName: workOrder.technician.name,
        technicianPhone: '',
        technicianEmail: workOrder.technician.email,
        completedDate,
        units: [unit],
      }, baseUrl);

      const greetingHtml = generateGreetingHtml({
        residentName: unit.dwellingUnit.residentName,
        organizationName: workOrder.organization.name,
        completedDate,
      });

      toast('Genererer PDF...', { icon: '📄' });
      let pdfBase64: string | undefined;
      try {
        pdfBase64 = await generatePdfInBrowser(reportHtml);
      } catch (pdfErr) {
        console.error('PDF generation failed', pdfErr);
      }

      // Always send full report as email body so it's never blank
      const emailBody = reportHtml;

      const emailRes = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `Rapport Ventilasjonsrens - ${workOrder.organization.address}`,
          html: emailBody,
          pdfBase64,
        }),
      });
      const emailResult = await emailRes.json();
      if (emailResult.error) throw new Error(emailResult.error);

      // Mark report as sent on unit
      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: unit.id, reportSentAt: new Date().toISOString() }),
      });

      toast.success(`Rapport sendt til ${email}`);
      fetchWorkOrder();
    } catch (err: any) {
      toast.error(err.message || 'Kunne ikke sende rapport');
    } finally {
      setSendingReport(null);
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
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-lg font-bold">{workOrder.units.length}</p>
            <p className="text-xs text-gray-500">Enheter</p>
          </div>
          <div>
            <p className="text-lg font-bold">{totalPrice > 0 ? formatCurrency(totalPrice) : '–'}</p>
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
          <>
            <Button fullWidth onClick={handleStartOrder}>
              <Play className="h-4 w-4" />
              Start oppdrag
            </Button>
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
        {workOrder.status === 'pagaar' && (
          <>
            <Button fullWidth onClick={() => setShowSignature(true)}>
              <CheckCircle className="h-4 w-4" />
              Fullfør oppdrag
            </Button>
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <XCircle className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Units */}
      <h2 className="text-sm font-semibold mb-3">Enheter ({workOrder.units.length})</h2>
      <div className="space-y-3">
        {workOrder.units.map((unit) => {
          const isActive = activeUnit === unit.id;

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
                        {unit.productName || unit.product?.name ? (
                          <>
                            <span className="text-xs text-gray-500">
                              {unit.productName || unit.product?.name}
                            </span>
                            <span className="text-xs font-medium">{formatCurrency(unit.price)}</span>
                            {unit.paymentPlanMonths != null && unit.paymentPlanMonths > 0 && (
                              <span className="text-[10px] text-gray-400">
                                {unit.paymentPlanMonths} mnd
                              </span>
                            )}
                            {unit.paymentMethod && (
                              <span className="text-[10px] text-gray-400 capitalize">
                                {unit.paymentMethod}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-orange-500 font-medium">Velg produkt</span>
                        )}
                      </div>
                      {unit.originalPrice != null && unit.originalPrice !== unit.price && (
                        <p className="text-[10px] text-orange-500">
                          Endret fra {unit.originalProduct} {formatCurrency(unit.originalPrice)}
                        </p>
                      )}
                    </div>
                  </div>
                  <StatusBadge type="payment" status={unit.paymentStatus} />
                </div>
              </div>

              {/* Expanded content */}
              {isActive && workOrder.status === 'pagaar' && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  {/* Product selection - shown prominently when no product chosen */}
                  {!unit.productName && !unit.product?.name ? (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-orange-800">
                        Velg produkt for denne enheten
                      </h4>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Ordretype</label>
                        <div className="flex gap-2">
                          {['ventilasjonsrens', 'service'].map((ot) => (
                            <button
                              key={ot}
                              onClick={() => {
                                setChangeUnitId(unit.id);
                                setChangeOrderType(ot);
                                const products = productsByOrderType[ot] || [];
                                if (products.length) {
                                  setChangeProduct(products[0].name);
                                  setChangePrice(products[0].price);
                                }
                              }}
                              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                                changeUnitId === unit.id && changeOrderType === ot ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {ot === 'ventilasjonsrens' ? 'Ventilasjonsrens' : 'Service'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Produkt</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(productsByOrderType[changeUnitId === unit.id ? changeOrderType : 'ventilasjonsrens'] || []).map((p) => (
                            <button
                              key={p.name}
                              onClick={() => {
                                setChangeUnitId(unit.id);
                                setChangeProduct(p.name);
                                setChangePrice(p.price);
                              }}
                              className={`py-3 px-2 rounded-xl text-center transition-colors ${
                                changeUnitId === unit.id && changeProduct === p.name ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <span className="text-sm font-medium block">{p.label}</span>
                              <span className="text-xs block mt-0.5">{formatCurrency(p.price)}</span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-2">
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Egendefinert beløp</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="Skriv inn beløp"
                            value={changeUnitId === unit.id && !(productsByOrderType[changeOrderType] || []).some(p => p.price === changePrice) ? changePrice || '' : ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setChangeUnitId(unit.id);
                              setChangeProduct('Egendefinert');
                              setChangePrice(val);
                            }}
                            onFocus={() => setChangeUnitId(unit.id)}
                            className="input-field"
                          />
                        </div>
                      </div>
                      {/* Nedbetaling */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nedbetaling</label>
                        <div className="grid grid-cols-3 gap-2">
                          {paymentPlanOptions.map((months) => {
                            const price = changeUnitId === unit.id ? changePrice : 0;
                            const monthlyAmount = months > 0 ? Math.ceil(price / months) : price;
                            return (
                              <button
                                key={months}
                                onClick={() => {
                                  setChangeUnitId(unit.id);
                                  setChangePaymentPlan(months);
                                }}
                                className={`py-3 px-2 rounded-xl text-center transition-colors ${
                                  changeUnitId === unit.id && changePaymentPlan === months ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <span className="text-sm font-medium block">{months === 0 ? 'Fullt' : `${months} mnd`}</span>
                                <span className="text-xs block mt-0.5">
                                  {months === 0 ? formatCurrency(price) : `${formatCurrency(monthlyAmount)}/mnd`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Betalingsmåte */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Betaling</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setChangeUnitId(unit.id);
                              setChangePaymentMethod('faktura');
                            }}
                            className={`py-3 px-2 rounded-xl text-center transition-colors ${
                              changeUnitId === unit.id && changePaymentMethod === 'faktura' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <span className="text-sm font-medium">Faktura</span>
                          </button>
                          <button
                            onClick={() => {
                              setChangeUnitId(unit.id);
                              setChangePaymentMethod('vipps');
                            }}
                            className={`py-3 px-2 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                              changeUnitId === unit.id && changePaymentMethod === 'vipps' ? 'bg-[#FF5B24] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <span className={`text-sm font-bold ${changeUnitId === unit.id && changePaymentMethod === 'vipps' ? 'text-white' : 'text-[#FF5B24]'}`}>Vipps</span>
                          </button>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        fullWidth
                        disabled={!changeProduct || changeUnitId !== unit.id}
                        onClick={() => {
                          setChangeOriginal({ orderType: unit.orderType, product: '', price: 0 });
                          handleChangeOrder();
                        }}
                      >
                        Bekreft produkt
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Payment summary + change order button */}
                      <div className="flex items-start justify-between">
                        <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1 flex-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Produkt</span>
                            <span className="font-medium">{unit.productName || unit.product?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Beløp</span>
                            <span className="font-medium">{formatCurrency(unit.price)}</span>
                          </div>
                          {unit.paymentPlanMonths != null && unit.paymentPlanMonths > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Nedbetaling</span>
                              <span>{unit.paymentPlanMonths} mnd ({formatCurrency(Math.ceil(unit.price / unit.paymentPlanMonths))}/mnd)</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-500">Betaling</span>
                            <span className="capitalize">{unit.paymentMethod || '–'}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="ml-2" onClick={() => openChangeOrder(unit)}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* ── RAPPORT ── */}
                      <div className="border-t border-gray-200 pt-3">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Rapport</h4>

                        {/* Standard utførelser (vises som info, trenger ikke hukes av) */}
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                            <CheckSquare className="h-3.5 w-3.5 inline mr-1" />
                            Utført arbeid
                          </h4>
                          <div className="space-y-1.5">
                            {['Rengjøring av tilluftskanaler', 'Rengjøring av avtrekkskanaler', 'Rens av ventiler og ventilrister'].map((item) => (
                              <div key={item} className="flex items-center gap-2 py-1">
                                <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0" />
                                <span className="text-sm">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Air measurements */}
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                            <Wind className="h-3.5 w-3.5 inline mr-1" />
                            Luftmålinger
                          </h4>
                          <div className="flex gap-2 items-end">
                            <Input
                              label="Før (l/s)"
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
                                Før: {unit.airBefore} l/s | Etter: {unit.airAfter} l/s
                              </span>
                              {unit.airAfter > unit.airBefore && (
                                <Badge color="bg-green-100 text-green-700" size="sm">
                                  +{Math.round(((unit.airAfter - unit.airBefore) / unit.airBefore) * 100)}%
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Photo upload */}
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                            <Camera className="h-3.5 w-3.5 inline mr-1" />
                            Dokumentasjon
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {/* Before photo */}
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Før-bilde</p>
                              {unit.photoBeforeUrl ? (
                                <div className="relative">
                                  <img
                                    src={unit.photoBeforeUrl}
                                    alt="Før"
                                    className="w-full h-28 object-cover rounded-xl border border-gray-200"
                                  />
                                  <div className="flex gap-1 mt-1">
                                    <label className="flex-1 text-center bg-gray-100 text-gray-600 text-[10px] py-1 rounded-lg cursor-pointer hover:bg-gray-200">
                                      Ta nytt
                                      <input type="file" accept="image/*" capture="environment" className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(unit.id, 'before', f); }} />
                                    </label>
                                    <label className="flex-1 text-center bg-gray-100 text-gray-600 text-[10px] py-1 rounded-lg cursor-pointer hover:bg-gray-200">
                                      Last opp
                                      <input type="file" accept="image/*" className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(unit.id, 'before', f); }} />
                                    </label>
                                  </div>
                                </div>
                              ) : uploadingPhoto === `before-${unit.id}` ? (
                                <div className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50">
                                  <span className="text-xs text-blue-500">Laster opp...</span>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <label className="flex items-center justify-center gap-1.5 h-14 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-400 transition-colors">
                                    <Camera className="h-4 w-4 text-gray-400" />
                                    <span className="text-xs text-gray-500">Ta bilde</span>
                                    <input type="file" accept="image/*" capture="environment" className="hidden"
                                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(unit.id, 'before', f); }} />
                                  </label>
                                  <label className="flex items-center justify-center gap-1.5 h-14 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-400 transition-colors">
                                    <ImageIcon className="h-4 w-4 text-gray-400" />
                                    <span className="text-xs text-gray-500">Kamerarull</span>
                                    <input type="file" accept="image/*" className="hidden"
                                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(unit.id, 'before', f); }} />
                                  </label>
                                </div>
                              )}
                            </div>

                            {/* After photo */}
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Etter-bilde</p>
                              {unit.photoAfterUrl ? (
                                <div className="relative">
                                  <img
                                    src={unit.photoAfterUrl}
                                    alt="Etter"
                                    className="w-full h-28 object-cover rounded-xl border border-gray-200"
                                  />
                                  <div className="flex gap-1 mt-1">
                                    <label className="flex-1 text-center bg-gray-100 text-gray-600 text-[10px] py-1 rounded-lg cursor-pointer hover:bg-gray-200">
                                      Ta nytt
                                      <input type="file" accept="image/*" capture="environment" className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(unit.id, 'after', f); }} />
                                    </label>
                                    <label className="flex-1 text-center bg-gray-100 text-gray-600 text-[10px] py-1 rounded-lg cursor-pointer hover:bg-gray-200">
                                      Last opp
                                      <input type="file" accept="image/*" className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(unit.id, 'after', f); }} />
                                    </label>
                                  </div>
                                </div>
                              ) : uploadingPhoto === `after-${unit.id}` ? (
                                <div className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50">
                                  <span className="text-xs text-blue-500">Laster opp...</span>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <label className="flex items-center justify-center gap-1.5 h-14 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-400 transition-colors">
                                    <Camera className="h-4 w-4 text-gray-400" />
                                    <span className="text-xs text-gray-500">Ta bilde</span>
                                    <input type="file" accept="image/*" capture="environment" className="hidden"
                                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(unit.id, 'after', f); }} />
                                  </label>
                                  <label className="flex items-center justify-center gap-1.5 h-14 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-400 transition-colors">
                                    <ImageIcon className="h-4 w-4 text-gray-400" />
                                    <span className="text-xs text-gray-500">Kamerarull</span>
                                    <input type="file" accept="image/*" className="hidden"
                                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(unit.id, 'after', f); }} />
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Send report */}
                        <div className="mb-3">
                          {unit.reportSentAt ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              Rapport sendt {new Date(unit.reportSentAt).toLocaleDateString('nb-NO')}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {!getUnitEmail(unit) ? (
                                <Input
                                  label="E-post til kunde"
                                  type="email"
                                  placeholder="kunde@example.no"
                                  value={manualEmails[unit.id] || ''}
                                  onChange={(e) => setManualEmails((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                                />
                              ) : (
                                <p className="text-xs text-gray-500">Sendes til: {getUnitEmail(unit)}</p>
                              )}
                              <Button
                                size="sm"
                                fullWidth
                                variant="secondary"
                                onClick={() => handleSendReport(unit)}
                                isLoading={sendingReport === unit.id}
                                disabled={!getUnitEmail(unit) && !manualEmails[unit.id]?.trim()}
                              >
                                <Send className="h-3.5 w-3.5" />
                                Send rapport til kunde
                              </Button>
                            </div>
                          )}
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
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

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
            <div className="mt-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Egendefinert beløp</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Skriv inn beløp"
                value={!(productsByOrderType[changeOrderType] || []).some(p => p.price === changePrice) ? changePrice || '' : ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setChangeProduct('Egendefinert');
                  setChangePrice(val);
                }}
                className="input-field"
              />
            </div>
          </div>

          {/* Nedbetaling */}
          <div>
            <label className="label">Nedbetaling</label>
            <div className="grid grid-cols-3 gap-2">
              {paymentPlanOptions.map((months) => {
                const monthlyAmount = months > 0 ? Math.ceil(changePrice / months) : changePrice;
                return (
                  <button
                    key={months}
                    onClick={() => setChangePaymentPlan(months)}
                    className={`py-3 px-2 rounded-xl text-center transition-colors ${
                      changePaymentPlan === months ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-sm font-medium block">{months === 0 ? 'Fullt' : `${months} mnd`}</span>
                    <span className="text-xs block mt-0.5">
                      {months === 0 ? formatCurrency(changePrice) : `${formatCurrency(monthlyAmount)}/mnd`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Betalingsmåte */}
          <div>
            <label className="label">Betaling</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setChangePaymentMethod('faktura')}
                className={`py-3 px-2 rounded-xl text-center transition-colors ${
                  changePaymentMethod === 'faktura' ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-sm font-medium">Faktura</span>
              </button>
              <button
                onClick={() => setChangePaymentMethod('vipps')}
                className={`py-3 px-2 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                  changePaymentMethod === 'vipps' ? 'bg-[#FF5B24] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className={`text-sm font-bold ${changePaymentMethod === 'vipps' ? 'text-white' : 'text-[#FF5B24]'}`}>Vipps</span>
              </button>
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
              <span className="text-lg font-bold">{totalPrice > 0 ? formatCurrency(totalPrice) : '–'}</span>
            </div>
            <Button fullWidth onClick={handleComplete} isLoading={completing}>
              <CheckCircle className="h-4 w-4" />
              Fullfør oppdrag
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete/cancel confirmation modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title={workOrder.status === 'pagaar' ? 'Avbryt oppdrag?' : 'Slett oppdrag?'}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {workOrder.status === 'pagaar'
              ? <>Er du sikker på at du vil avbryte oppdraget for <span className="font-semibold">{workOrder.organization.name}</span>? Alt arbeid som ikke er lagret vil gå tapt.</>
              : <>Er du sikker på at du vil slette oppdraget for <span className="font-semibold">{workOrder.organization.name}</span>?</>
            }
          </p>
          <div className="flex gap-3">
            <Button fullWidth variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              Nei, behold
            </Button>
            <Button fullWidth variant="danger" onClick={handleDeleteOrder} isLoading={deleting}>
              {workOrder.status === 'pagaar' ? 'Avbryt oppdrag' : 'Slett oppdrag'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
