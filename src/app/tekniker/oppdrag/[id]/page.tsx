'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Clock, CheckCircle,
  CreditCard, Camera, Send,
  Image as ImageIcon, Edit3,
} from 'lucide-react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import AvailableSlotPicker from '@/components/ui/available-slot-picker';
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
    notes: string | null;
  };
  product: {
    name: string;
    price: number;
  } | null;
}

interface TechVisitInfo {
  id: string;
  unitNumber: string;
  address: string;
  postalCode: string | null;
  city: string | null;
  ownerName: string | null;
  ownerBirthDate: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  residentName: string | null;
  notes: string | null;
}

interface WorkOrder {
  id: string;
  technicianId: string;
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
  techVisits: TechVisitInfo[];
}

export default function TeknikerOppdragDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeUnit, setActiveUnit] = useState<string | null>(null);

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
  const [visitNotes, setVisitNotes] = useState<Record<string, string>>({}); // techVisitId -> notes
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [savingDate, setSavingDate] = useState(false);

  // Editable customer info state
  const [customerName, setCustomerName] = useState<Record<string, string>>({});
  const [customerEmail, setCustomerEmail] = useState<Record<string, string>>({});
  const [customerPhone, setCustomerPhone] = useState<Record<string, string>>({});
  const [customerAddress, setCustomerAddress] = useState<Record<string, string>>({});


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

  // Auto-start work order when technician opens the page
  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (workOrder && workOrder.status === 'planlagt' && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pagaar' }),
      }).then(() => fetchWorkOrder());
    }
  }, [workOrder, id, fetchWorkOrder]);


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
      bankterminal: 'betalt',
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

  const handleSaveDate = async () => {
    if (!newDate || !newTime) {
      toast.error('Velg dato og klokkeslett');
      return;
    }
    setSavingDate(true);
    try {
      const scheduledAt = new Date(`${newDate}T${newTime}`).toISOString();
      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt }),
      });
      toast.success('Dato oppdatert');
      setEditingDate(false);
      setNewDate('');
      setNewTime('');
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke oppdatere dato');
    } finally {
      setSavingDate(false);
    }
  };

  const handleSaveVisitNote = async (techVisitId: string) => {
    const note = visitNotes[techVisitId];
    if (note === undefined) return;
    setSavingNote(techVisitId);
    try {
      await fetch(`/api/tech-visits/${techVisitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note }),
      });
      toast.success('Notat lagret');
      fetchWorkOrder();
    } catch {
      toast.error('Kunne ikke lagre notat');
    } finally {
      setSavingNote(null);
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
    const name = (customerName[unit.id] ?? unit.dwellingUnit.residentName ?? '').trim();
    const address = (customerAddress[unit.id] ?? workOrder?.organization.address ?? '').trim();

    if (!name) {
      toast.error('Legg inn kundens navn');
      return;
    }
    if (!address) {
      toast.error('Legg inn adresse');
      return;
    }
    if (!unit.paymentMethod) {
      toast.error('Velg betalingsløsning først');
      return;
    }

    setSendingReport(unit.id);
    try {
      if (!workOrder) return;

      // Save customer info to dwelling unit
      const updateData: any = { dwellingUnitId: unit.dwellingUnit.id };
      const email = (customerEmail[unit.id] ?? unit.dwellingUnit.residentEmail ?? '').trim();
      const phone = (customerPhone[unit.id] ?? unit.dwellingUnit.residentPhone ?? '').trim();
      if (name) updateData.residentName = name;
      if (email) updateData.residentEmail = email;
      if (phone) updateData.residentPhone = phone;

      await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const { generateReportHtml, generateGreetingHtml } = await import('@/lib/report');
      const baseUrl = window.location.origin;
      const completedDate = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

      // Use manually entered customer info
      const unitWithCustomerInfo = {
        ...unit,
        dwellingUnit: {
          ...unit.dwellingUnit,
          residentName: name,
          residentPhone: phone || unit.dwellingUnit.residentPhone,
          residentEmail: email || unit.dwellingUnit.residentEmail,
        },
      };

      const reportHtml = generateReportHtml({
        organizationName: name,
        organizationAddress: address,
        organizationPostalCode: workOrder.organization.postalCode || '',
        technicianName: workOrder.technician.name,
        technicianPhone: '936 72 506',
        technicianEmail: 'haavard@godtvedlikehold.no',
        completedDate,
        units: [unitWithCustomerInfo],
      }, baseUrl);

      const greetingHtml = generateGreetingHtml({
        residentName: name,
        organizationName: 'Godt Vedlikehold',
        completedDate,
      });

      toast('Genererer PDF...', { icon: '📄' });
      let pdfBase64: string;
      try {
        pdfBase64 = await generatePdfInBrowser(reportHtml);
      } catch (pdfErr) {
        console.error('PDF generation failed', pdfErr);
        toast.error('Kunne ikke generere PDF. Prøv igjen.');
        return;
      }

      // Send to both internal email and customer email (if available)
      const recipients = ['hei@godtvedlikehold.no'];
      const custEmail = (customerEmail[unit.id] ?? unit.dwellingUnit.residentEmail ?? '').trim();
      if (custEmail) recipients.push(custEmail);

      const emailRes = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients,
          subject: `Rapport Ventilasjonsrens - ${name} - ${address}`,
          html: greetingHtml,
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

      // Check if all units now have reports sent – if so, auto-complete the work order
      const otherUnitsAllSent = workOrder.units
        .filter((u) => u.id !== unit.id)
        .every((u) => u.reportSentAt);

      if (otherUnitsAllSent) {
        await fetch(`/api/work-orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'fullfort' }),
        });
        toast.success('Rapport sendt og oppdrag fullført!');
      } else {
        toast.success('Rapport sendt!');
      }
      fetchWorkOrder();
    } catch (err: any) {
      toast.error(err.message || 'Kunne ikke sende rapport');
    } finally {
      setSendingReport(null);
    }
  };



  if (loading) return <LoadingSpinner />;
  if (!workOrder) return <EmptyState title="Oppdrag ikke funnet" description="Kunne ikke finne dette oppdraget" />;

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
      </div>

      {/* Schedule info */}
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{formatDate(workOrder.scheduledAt)} kl. {formatTime(workOrder.scheduledAt)}</span>
          </div>
          {workOrder.status !== 'fullfort' && (
            <button
              onClick={() => {
                const d = new Date(workOrder.scheduledAt);
                setNewDate(d.toISOString().split('T')[0]);
                setNewTime(d.toTimeString().slice(0, 5));
                setEditingDate(!editingDate);
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
        </div>
        {editingDate && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            <AvailableSlotPicker
              userId={workOrder.technicianId}
              onSelect={(date, time) => {
                setNewDate(date);
                setNewTime(time);
              }}
              selectedDate={newDate || null}
              selectedTime={newTime || null}
            />
            {newDate && newTime && (
              <div className="flex gap-2">
                <Button size="sm" fullWidth onClick={handleSaveDate} isLoading={savingDate}>
                  Lagre ny tid
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingDate(false); setNewDate(''); setNewTime(''); }}>
                  Avbryt
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Tech visit info (from besøk) */}
      {workOrder.techVisits.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Besøksinfo</h2>
          {workOrder.techVisits.map((tv) => (
            <div key={tv.id} className="space-y-2">
              {tv.ownerName && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Eier:</span>
                  <span className="font-semibold">{tv.ownerName}</span>
                </div>
              )}
              {tv.ownerBirthDate && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Født:</span>
                  <span className="font-medium">{tv.ownerBirthDate}</span>
                </div>
              )}
              {tv.ownerPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Telefon:</span>
                  <a href={`tel:${tv.ownerPhone}`} className="font-medium text-blue-600">{tv.ownerPhone}</a>
                </div>
              )}
              {tv.ownerEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">E-post:</span>
                  <a href={`mailto:${tv.ownerEmail}`} className="font-medium text-blue-600">{tv.ownerEmail}</a>
                </div>
              )}
              {tv.residentName && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Beboer:</span>
                  <span className="font-medium">{tv.residentName}</span>
                </div>
              )}
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Notat</label>
                <textarea
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                  placeholder="Legg til notat..."
                  value={visitNotes[tv.id] ?? tv.notes ?? ''}
                  onChange={(e) => setVisitNotes((prev) => ({ ...prev, [tv.id]: e.target.value }))}
                  onBlur={() => {
                    const current = visitNotes[tv.id];
                    if (current !== undefined && current !== (tv.notes ?? '')) {
                      handleSaveVisitNote(tv.id);
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </Card>
      )}

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
                      {unit.dwellingUnit.notes && (
                        <p className="text-xs text-gray-500">{unit.dwellingUnit.notes}</p>
                      )}
                      {unit.reportSentAt && (
                        <span className="text-xs text-green-600">Rapport sendt</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded content */}
              {isActive && (
                <div className="border-t border-gray-100 p-4 space-y-4">

                  {/* ── KUNDEINFORMASJON ── */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Kundeinformasjon</h4>
                    {workOrder.status === 'fullfort' ? (
                      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                        <p><span className="text-gray-500">Navn:</span> <strong>{unit.dwellingUnit.residentName || '–'}</strong></p>
                        <p><span className="text-gray-500">E-post:</span> {unit.dwellingUnit.residentEmail || '–'}</p>
                        <p><span className="text-gray-500">Telefon:</span> {unit.dwellingUnit.residentPhone || '–'}</p>
                        <p><span className="text-gray-500">Adresse:</span> {workOrder.organization.address || '–'}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Input
                          label="Navn"
                          type="text"
                          placeholder="Kundens fulle navn"
                          value={customerName[unit.id] ?? unit.dwellingUnit.residentName ?? ''}
                          onChange={(e) => setCustomerName((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                        />
                        <Input
                          label="E-post"
                          type="email"
                          placeholder="kunde@example.no"
                          value={customerEmail[unit.id] ?? unit.dwellingUnit.residentEmail ?? ''}
                          onChange={(e) => setCustomerEmail((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                        />
                        <Input
                          label="Telefon"
                          type="tel"
                          placeholder="999 99 999"
                          value={customerPhone[unit.id] ?? unit.dwellingUnit.residentPhone ?? ''}
                          onChange={(e) => setCustomerPhone((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                        />
                        <Input
                          label="Adresse"
                          type="text"
                          placeholder="Gateadresse, postnr sted"
                          value={customerAddress[unit.id] ?? workOrder.organization.address ?? ''}
                          onChange={(e) => setCustomerAddress((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  {/* ── BETALINGSLØSNING ── */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                      <CreditCard className="h-3.5 w-3.5 inline mr-1" />
                      Betalingsløsning
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handlePayment(unit.id, 'faktura')}
                        className={`py-3 px-2 rounded-xl text-center transition-colors ${
                          unit.paymentMethod === 'faktura' ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <CreditCard className={`h-5 w-5 mx-auto mb-1 ${unit.paymentMethod === 'faktura' ? 'text-white' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium">Faktura</span>
                      </button>
                      <button
                        onClick={() => handlePayment(unit.id, 'vipps')}
                        className={`py-3 px-2 rounded-xl text-center transition-colors ${
                          unit.paymentMethod === 'vipps' ? 'bg-[#FF5B24] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className={`text-lg font-bold block mb-0.5 ${unit.paymentMethod === 'vipps' ? 'text-white' : 'text-[#FF5B24]'}`}>V</span>
                        <span className="text-sm font-medium">Vipps</span>
                      </button>
                      <button
                        onClick={() => handlePayment(unit.id, 'bankterminal')}
                        className={`py-3 px-2 rounded-xl text-center transition-colors ${
                          unit.paymentMethod === 'bankterminal' ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <CreditCard className={`h-5 w-5 mx-auto mb-1 ${unit.paymentMethod === 'bankterminal' ? 'text-white' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium">Terminal</span>
                      </button>
                    </div>
                  </div>

                  {/* ── BILDER ── */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                      <Camera className="h-3.5 w-3.5 inline mr-1" />
                      Før og etter bilder
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Before photo */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Før-bilde</p>
                        {unit.photoBeforeUrl ? (
                          <div className="relative">
                            <img src={unit.photoBeforeUrl} alt="Før" className="w-full h-28 object-cover rounded-xl border border-gray-200" />
                            {workOrder.status === 'pagaar' && (
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
                            )}
                          </div>
                        ) : workOrder.status === 'pagaar' ? (
                          uploadingPhoto === `before-${unit.id}` ? (
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
                          )
                        ) : (
                          <div className="flex items-center justify-center h-28 rounded-xl bg-gray-50 border border-gray-200">
                            <span className="text-xs text-gray-400">Ingen bilde</span>
                          </div>
                        )}
                      </div>

                      {/* After photo */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Etter-bilde</p>
                        {unit.photoAfterUrl ? (
                          <div className="relative">
                            <img src={unit.photoAfterUrl} alt="Etter" className="w-full h-28 object-cover rounded-xl border border-gray-200" />
                            {workOrder.status === 'pagaar' && (
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
                            )}
                          </div>
                        ) : workOrder.status === 'pagaar' ? (
                          uploadingPhoto === `after-${unit.id}` ? (
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
                          )
                        ) : (
                          <div className="flex items-center justify-center h-28 rounded-xl bg-gray-50 border border-gray-200">
                            <span className="text-xs text-gray-400">Ingen bilde</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── SEND RAPPORT ── */}
                  <div>
                    {unit.reportSentAt ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Rapport sendt {new Date(unit.reportSentAt).toLocaleDateString('nb-NO')}
                      </div>
                    ) : workOrder.status === 'pagaar' ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500">Sendes til: hei@godtvedlikehold.no</p>
                        <Button
                          size="sm"
                          fullWidth
                          onClick={() => handleSendReport(unit)}
                          isLoading={sendingReport === unit.id}
                          disabled={!(customerName[unit.id]?.trim() ?? unit.dwellingUnit.residentName) || !unit.paymentMethod}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Send rapport
                        </Button>
                      </div>
                    ) : null}
                  </div>
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


    </div>
  );
}
