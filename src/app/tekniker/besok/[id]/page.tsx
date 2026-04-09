'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, MapPin, Phone, User, Home, Calendar,
  Trash2, ExternalLink, Mail, Edit3, DoorOpen,
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

  // Edit state
  const [editing, setEditing] = useState(false);
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

  const startEdit = () => {
    if (!visit) return;
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
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editForm.unitNumber.trim() || !editForm.address.trim()) {
      toast.error('Leilighet og adresse er påkrevd');
      return;
    }
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
      toast.success('Besøk oppdatert');
      setEditing(false);
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
      const scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
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
            : visit.notHomeCount > 0
              ? 'bg-amber-100 text-amber-700'
              : 'bg-blue-100 text-blue-700'
        }`}>
          {visit.status === 'bestilt'
            ? 'Bestilt'
            : visit.notHomeCount > 0
              ? `Ikke hjemme (${visit.notHomeCount})`
              : 'Ny'}
        </span>
      </div>

      {/* Visit info — view mode */}
      {!editing && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Besøksinfo</h2>
            <button onClick={startEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <Edit3 className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {visit.ownerName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Eier:</span>
                <span className="font-semibold">{visit.ownerName}</span>
              </div>
            )}
            {visit.ownerBirthDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Født:</span>
                <span className="font-medium">{visit.ownerBirthDate}</span>
              </div>
            )}
            {visit.ownerPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Telefon:</span>
                <a href={`tel:${visit.ownerPhone}`} className="font-medium text-blue-600">
                  {visit.ownerPhone}
                </a>
              </div>
            )}
            {visit.ownerEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">E-post:</span>
                <a href={`mailto:${visit.ownerEmail}`} className="font-medium text-blue-600">
                  {visit.ownerEmail}
                </a>
              </div>
            )}
            {visit.residentName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Beboer:</span>
                <span className="font-medium">{visit.residentName}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Home className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Leilighet:</span>
              <span className="font-medium">{visit.unitNumber}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Adresse:</span>
              <span className="font-medium">
                {visit.address}
                {visit.postalCode && `, ${visit.postalCode}`}
                {visit.city && ` ${visit.city}`}
              </span>
            </div>
            {visit.notes && (
              <div className="mt-2 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
                {visit.notes}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">Registrert {formatDate(visit.createdAt)}</p>
          </div>
        </Card>
      )}

      {/* Visit info — edit mode */}
      {editing && (
        <Card className="mb-4 space-y-4">
          <h2 className="text-sm font-semibold">Rediger besøk</h2>

          <Input label="Leilighet *" value={editForm.unitNumber} onChange={(e) => setEditForm({ ...editForm, unitNumber: e.target.value })} />
          <Input label="Adresse *" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Postnr" value={editForm.postalCode} onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })} />
            <Input label="Sted" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
          </div>
          <Input label="Eier" value={editForm.ownerName} onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Født" value={editForm.ownerBirthDate} onChange={(e) => setEditForm({ ...editForm, ownerBirthDate: e.target.value })} />
            <Input label="Telefon" type="tel" value={editForm.ownerPhone} onChange={(e) => setEditForm({ ...editForm, ownerPhone: e.target.value })} />
          </div>
          <Input label="E-post" type="email" value={editForm.ownerEmail} onChange={(e) => setEditForm({ ...editForm, ownerEmail: e.target.value })} />
          <Input label="Beboer" value={editForm.residentName} onChange={(e) => setEditForm({ ...editForm, residentName: e.target.value })} />
          <textarea
            className="input-field min-h-[80px]"
            placeholder="Notat..."
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
          />

          <div className="flex gap-2">
            <Button fullWidth variant="secondary" onClick={() => setEditing(false)}>
              Avbryt
            </Button>
            <Button fullWidth onClick={handleSave} isLoading={saving}>
              Lagre
            </Button>
          </div>
        </Card>
      )}

      {/* Not home indicator */}
      {visit.notHomeCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <DoorOpen className="h-4 w-4 text-amber-600" />
          <span className="text-amber-700 font-medium">
            Ikke hjemme {visit.notHomeCount} {visit.notHomeCount === 1 ? 'gang' : 'ganger'}
          </span>
        </div>
      )}

      {/* Not home button (only if status is ny) */}
      {visit.status === 'ny' && (
        <Button
          fullWidth
          variant="secondary"
          onClick={handleNotHome}
          isLoading={markingNotHome}
          className="mb-4"
        >
          <DoorOpen className="h-4 w-4" />
          Ikke hjemme
        </Button>
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

      {/* Status: ny — show create order form */}
      {visit.status === 'ny' && (
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
