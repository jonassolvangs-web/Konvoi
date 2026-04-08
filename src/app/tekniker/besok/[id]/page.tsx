'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Phone, User, Home, Calendar,
  Clock, Trash2, ExternalLink,
} from 'lucide-react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils';
import { productsByOrderType } from '@/lib/constants';
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
  residentName: string | null;
  notes: string | null;
  status: string;
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
  const [visit, setVisit] = useState<TechVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Create order state
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [orderType, setOrderType] = useState('ventilasjonsrens');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchVisit() {
      try {
        const res = await fetch(`/api/tech-visits/${id}`);
        const data = await res.json();
        setVisit(data.visit || null);
      } catch {
        setVisit(null);
      } finally {
        setLoading(false);
      }
    }
    fetchVisit();
  }, [id]);

  // Set default product when order type changes
  useEffect(() => {
    const products = productsByOrderType[orderType] || [];
    if (products.length > 0) {
      setSelectedProduct(products[0].name);
      setSelectedPrice(products[0].price);
    }
  }, [orderType]);

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
    if (!scheduledDate) {
      toast.error('Velg dato');
      return;
    }

    setCreating(true);
    try {
      const scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
      const res = await fetch(`/api/tech-visits/${id}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt,
          orderType,
          product: selectedProduct,
          price: selectedPrice,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success('Bestilling opprettet!');
      // Refresh visit data
      const visitRes = await fetch(`/api/tech-visits/${id}`);
      const visitData = await visitRes.json();
      setVisit(visitData.visit || null);
    } catch (err: any) {
      toast.error(err.message || 'Kunne ikke opprette bestilling');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!visit) return <EmptyState title="Ikke funnet" description="Besøket ble ikke funnet" />;

  const products = productsByOrderType[orderType] || [];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Besøk {visit.unitNumber}</h1>
          <p className="text-xs text-gray-500">{visit.address}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          visit.status === 'bestilt' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {visit.status === 'bestilt' ? 'Bestilt' : 'Ny'}
        </span>
      </div>

      {/* Visit info */}
      <Card className="mb-4">
        <h2 className="text-sm font-semibold mb-3">Besøksinfo</h2>
        <div className="space-y-2">
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
          {visit.ownerName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Eier:</span>
              <span className="font-medium">{visit.ownerName}</span>
              {visit.ownerBirthDate && (
                <span className="text-gray-400 text-xs">({visit.ownerBirthDate})</span>
              )}
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
          {visit.residentName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Beboer:</span>
              <span className="font-medium">{visit.residentName}</span>
            </div>
          )}
          {visit.notes && (
            <div className="mt-2 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
              {visit.notes}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">Registrert {formatDate(visit.createdAt)}</p>
        </div>
      </Card>

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
            {/* Date and time */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Dato"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
              <Input
                label="Klokkeslett"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>

            {/* Order type */}
            <div>
              <label className="label">Ordretype</label>
              <div className="flex gap-2">
                {['ventilasjonsrens', 'service'].map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    onClick={() => setOrderType(ot)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      orderType === ot ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {ot === 'ventilasjonsrens' ? 'Ventilasjonsrens' : 'Service'}
                  </button>
                ))}
              </div>
            </div>

            {/* Product */}
            <div>
              <label className="label">Produkt</label>
              <div className="grid grid-cols-3 gap-2">
                {products.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => { setSelectedProduct(p.name); setSelectedPrice(p.price); }}
                    className={`py-3 px-2 rounded-xl text-center transition-colors ${
                      selectedProduct === p.name ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-sm font-medium block">{p.label}</span>
                    <span className="text-xs block mt-0.5">{formatCurrency(p.price)}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button fullWidth onClick={handleCreateOrder} isLoading={creating}>
              <Calendar className="h-4 w-4" />
              Opprett bestilling
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
