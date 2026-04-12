'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, MapPin, Phone, User, Home, Calendar,
  Trash2, ExternalLink, Mail, DoorOpen, HelpCircle,
} from 'lucide-react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import AvailableSlotPicker from '@/components/ui/available-slot-picker';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import { formatDate, formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface TechVisit {
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
  status: string;
  notHomeCount: number;
  lastNotHomeAt: string | null;
  createdAt: string;
  workOrder: {
    id: string;
    status: string;
    scheduledAt: string;
  } | null;
}

export default function BesokDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;
  const [visit, setVisit] = useState<TechVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Create order state
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    unitNumber: '',
    address: '',
    postalCode: '',
    city: '',
    ownerName: '',
    ownerBirthDate: '',
    ownerPhone: '',
    ownerEmail: '',
    residentName: '',
    notes: '',
  });

  const fetchVisit = async () => {
    try {
      const res = await fetch(`/api/tech-visits/${id}`);
      const data = await res.json();
      setVisit(data.visit || null);
    } catch {
      setVisit(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisit();
  }, [id]);

  // Sync editForm when visit loads/updates
  useEffect(() => {
    if (visit) {
      setEditForm({
        unitNumber: visit.unitNumber,
        address: visit.address,
        postalCode: visit.postalCode || '',
        city: visit.city || '',
        ownerName: visit.ownerName || '',
        ownerBirthDate: visit.ownerBirthDate || '',
        ownerPhone: visit.ownerPhone || '',
        ownerEmail: visit.ownerEmail || '',
        residentName: visit.residentName || '',
        notes: visit.notes || '',
      });
    }
  }, [visit]);

  const handleSave = async () => {
    if (!visit) return;
    if (!editForm.unitNumber.trim() || !editForm.address.trim()) return;

    // Check if anything changed
    const hasChanged =
      editForm.unitNumber !== visit.unitNumber ||
      editForm.address !== visit.address ||
      editForm.postalCode !== (visit.postalCode || '') ||
      editForm.city !== (visit.city || '') ||
      editForm.ownerName !== (visit.ownerName || '') ||
      editForm.ownerBirthDate !== (visit.ownerBirthDate || '') ||
      editForm.ownerPhone !== (visit.ownerPhone || '') ||
      editForm.ownerEmail !== (visit.ownerEmail || '') ||
      editForm.residentName !== (visit.residentName || '') ||
      editForm.notes !== (visit.notes || '');

    if (!hasChanged) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/tech-visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitNumber: editForm.unitNumber.trim(),
          address: editForm.address.trim(),
          postalCode: editForm.postalCode.trim() || null,
          city: editForm.city.trim() || null,
          ownerName: editForm.ownerName.trim() || null,
          ownerBirthDate: editForm.ownerBirthDate.trim() || null,
          ownerPhone: editForm.ownerPhone.trim() || null,
          ownerEmail: editForm.ownerEmail.trim() || null,
          residentName: editForm.residentName.trim() || null,
          notes: editForm.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Kunne ikke lagre');
      toast.success('Lagret');
      await fetchVisit();
    } catch (err: any) {
      toast.error(err.message || 'Noe gikk galt');
    } finally {
      setSaving(false);
    }
  };

  const [markingNotHome, setMarkingNotHome] = useState(false);

  const handleNotHome = async () => {
    setMarkingNotHome(true);
    try {
      const res = await fetch(`/api/tech-visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'not_home' }),
      });
      if (!res.ok) throw new Error('Kunne ikke registrere');
      toast.success('Registrert som ikke hjemme');
      await fetchVisit();
    } catch (err: any) {
      toast.error(err.message || 'Noe gikk galt');
    } finally {
      setMarkingNotHome(false);
    }
  };

  const [markingTenker, setMarkingTenker] = useState(false);

  const handleTenker = async () => {
    setMarkingTenker(true);
    try {
      const res = await fetch(`/api/tech-visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tenker' }),
      });
      if (!res.ok) throw new Error('Kunne ikke registrere');
      toast.success('Markert som tenker');
      await fetchVisit();
    } catch (err: any) {
      toast.error(err.message || 'Noe gikk galt');
    } finally {
      setMarkingTenker(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Er du sikker på at du vil slette dette besøket?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tech-visits/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success('Besøk slettet');
      router.push('/tekniker/besok');
    } catch (err: any) {
      toast.error(err.message || 'Kunne ikke slette');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!scheduledDate || !scheduledTime) {
      toast.error('Velg dato og tid');
      return;
    }

    setCreating(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      const res = await fetch(`/api/tech-visits/${id}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success('Bestilling opprettet!');
      await fetchVisit();
    } catch (err: any) {
      toast.error(err.message || 'Kunne ikke opprette bestilling');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!visit) return <EmptyState title="Ikke funnet" description="Besøket ble ikke funnet" />;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-12 min-w-[56px] px-2 rounded-lg bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
            {visit.unitNumber}
          </div>
          <div>
            <h1 className="text-lg font-bold">
              {visit.ownerName || 'Ukjent'}
              {visit.residentName && <span className="text-sm font-normal text-gray-500"> (Beboer: {visit.residentName})</span>}
            </h1>
            <p className="text-xs text-gray-500">{visit.address}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          visit.status === 'bestilt'
            ? 'bg-green-100 text-green-700'
            : visit.status === 'tenker'
              ? 'bg-purple-100 text-purple-700'
              : visit.notHomeCount > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
        }`}>
          {visit.status === 'bestilt'
            ? 'Bestilt'
            : visit.status === 'tenker'
              ? 'Tenker'
              : visit.notHomeCount > 0
                ? 'Ikke hjemme'
                : 'Ny'}
        </span>
      </div>

      {/* Visit info — always editable */}
      <Card className="mb-4 space-y-3">
        <h2 className="text-sm font-semibold">Besøksinfo</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Leilighet" value={editForm.unitNumber} onChange={(e) => setEditForm({ ...editForm, unitNumber: e.target.value })} onBlur={() => handleSave()} />
          <Input label="Født" value={editForm.ownerBirthDate} onChange={(e) => setEditForm({ ...editForm, ownerBirthDate: e.target.value })} onBlur={() => handleSave()} />
        </div>
        <Input label="Eier" value={editForm.ownerName} onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })} onBlur={() => handleSave()} />
        <Input label="Beboer" value={editForm.residentName} onChange={(e) => setEditForm({ ...editForm, residentName: e.target.value })} onBlur={() => handleSave()} />
        <Input label="Adresse" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} onBlur={() => handleSave()} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Postnr" value={editForm.postalCode} onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })} onBlur={() => handleSave()} />
          <Input label="Sted" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} onBlur={() => handleSave()} />
        </div>
        <Input label="Telefon" type="tel" value={editForm.ownerPhone} onChange={(e) => setEditForm({ ...editForm, ownerPhone: e.target.value })} onBlur={() => handleSave()} />
        <Input label="E-post" type="email" value={editForm.ownerEmail} onChange={(e) => setEditForm({ ...editForm, ownerEmail: e.target.value })} onBlur={() => handleSave()} />
        <textarea
          className="input-field min-h-[80px] w-full"
          placeholder="Skriv et notat..."
          value={editForm.notes}
          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
          onBlur={() => handleSave()}
        />
        <p className="text-xs text-gray-400">Registrert {formatDate(visit.createdAt)}</p>
      </Card>

      {/* Not home indicator */}
      {visit.notHomeCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <DoorOpen className="h-4 w-4 text-amber-600" />
          <span className="text-amber-700 font-medium">
            Ikke hjemme {visit.notHomeCount} {visit.notHomeCount === 1 ? 'gang' : 'ganger'}
          </span>
        </div>
      )}

      {/* Action buttons (only if status is ny or tenker) */}
      {(visit.status === 'ny' || visit.status === 'tenker') && (
        <div className="flex gap-2 mb-4">
          <Button
            fullWidth
            variant="secondary"
            onClick={handleNotHome}
            isLoading={markingNotHome}
          >
            <DoorOpen className="h-4 w-4" />
            Ikke hjemme
          </Button>
          <Button
            fullWidth
            variant="secondary"
            onClick={handleTenker}
            isLoading={markingTenker}
          >
            <HelpCircle className="h-4 w-4" />
            Tenker
          </Button>
        </div>
      )}

      {/* Status: bestilt — show work order link */}
      {visit.status === 'bestilt' && visit.workOrder && (
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-green-700">Bestilling opprettet</h2>
              <p className="text-xs text-gray-500 mt-1">
                Planlagt {formatDate(visit.workOrder.scheduledAt)} kl. {formatTime(visit.workOrder.scheduledAt)}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push(`/tekniker/oppdrag/${visit.workOrder!.id}`)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Se oppdrag
            </Button>
          </div>
        </Card>
      )}

      {/* Create order form (if no work order yet) */}
      {!visit.workOrder && (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold mb-4">Opprett bestilling</h2>

          <div className="space-y-4">
            {userId && (
              <AvailableSlotPicker
                userId={userId}
                onSelect={(date, time) => {
                  setScheduledDate(date);
                  setScheduledTime(time);
                }}
                selectedDate={scheduledDate}
                selectedTime={scheduledTime}
              />
            )}

            <Button
              fullWidth
              onClick={handleCreateOrder}
              isLoading={creating}
              disabled={!scheduledDate || !scheduledTime}
            >
              <Calendar className="h-4 w-4" />
              Opprett bestilling {scheduledDate && scheduledTime ? `${scheduledTime}` : ''}
            </Button>
          </div>
        </Card>
      )}

      {/* Delete button (only if no work order) */}
      {!visit.workOrder && (
        <Button
          fullWidth
          variant="danger"
          onClick={handleDelete}
          isLoading={deleting}
        >
          <Trash2 className="h-4 w-4" />
          Slett besøk
        </Button>
      )}
    </div>
  );
}
