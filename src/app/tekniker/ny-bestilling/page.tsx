'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import toast from 'react-hot-toast';

export default function NyBestillingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [orderType, setOrderType] = useState('ventilasjonsrens');
  const [product, setProduct] = useState('Standard');
  const [price, setPrice] = useState(3990);

  const products: Record<string, { name: string; price: number }[]> = {
    ventilasjonsrens: [
      { name: 'Standard', price: 3990 },
      { name: 'Medium', price: 4990 },
      { name: 'Stor', price: 5990 },
    ],
    service: [
      { name: 'Ny reim', price: 800 },
      { name: 'Service Standard', price: 1990 },
      { name: 'Service Pluss', price: 2990 },
    ],
  };

  const handleOrderTypeChange = (type: string) => {
    setOrderType(type);
    const first = products[type]?.[0];
    if (first) {
      setProduct(first.name);
      setPrice(first.price);
    }
  };

  const handleProductChange = (productName: string) => {
    setProduct(productName);
    const p = products[orderType]?.find((x) => x.name === productName);
    if (p) setPrice(p.price);
  };

  const handleSubmit = async () => {
    if (!customerName || !address || !date) {
      toast.error('Fyll inn navn, adresse og dato');
      return;
    }

    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      const res = await fetch('/api/work-orders/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          address,
          postalCode,
          city,
          phone,
          email,
          scheduledAt,
          orderType,
          product,
          price,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Feil');
      }

      toast.success('Oppdrag opprettet!');
      router.push('/tekniker/oppdrag');
    } catch (err: any) {
      toast.error(err.message || 'Kunne ikke opprette oppdrag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <ArrowLeft className="h-4 w-4" /> Tilbake
      </button>

      <h1 className="page-title mb-4">Nytt oppdrag</h1>

      {/* Kundeinformasjon */}
      <Card className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Kundeinformasjon</h2>
        <div className="space-y-3">
          <Input label="Navn *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Fullt navn" />
          <Input label="Adresse *" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Gateadresse" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Postnr" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="0000" />
            <Input label="Sted" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Oslo" />
          </div>
          <Input label="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="000 00 000" />
          <Input label="E-post" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kunde@epost.no" />
        </div>
      </Card>

      {/* Tidspunkt */}
      <Card className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Tidspunkt</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Dato *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Klokkeslett</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </Card>

      {/* Produkt */}
      <Card className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Type oppdrag</h2>

        <div className="flex gap-2 mb-3">
          {['ventilasjonsrens', 'service'].map((type) => (
            <button
              key={type}
              onClick={() => handleOrderTypeChange(type)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                orderType === type
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type === 'ventilasjonsrens' ? 'Ventilasjonsrens' : 'Service'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {products[orderType]?.map((p) => (
            <button
              key={p.name}
              onClick={() => handleProductChange(p.name)}
              className={`p-3 rounded-xl text-sm text-left transition-colors ${
                product === p.name
                  ? 'bg-blue-50 border-2 border-blue-500'
                  : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
              }`}
            >
              <span className="font-medium block">{p.name}</span>
              <span className="text-gray-500">{p.price.toLocaleString('nb-NO')} kr</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Opprett */}
      <Button onClick={handleSubmit} isLoading={saving} className="w-full">
        Opprett oppdrag
      </Button>
    </div>
  );
}
