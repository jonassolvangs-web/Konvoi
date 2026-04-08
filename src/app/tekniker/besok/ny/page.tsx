'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Card from '@/components/ui/card';
import toast from 'react-hot-toast';

export default function NyttBesokPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [unitNumber, setUnitNumber] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerBirthDate, setOwnerBirthDate] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [residentName, setResidentName] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unitNumber.trim() || !address.trim()) {
      toast.error('Leilighet og adresse er påkrevd');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/tech-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitNumber: unitNumber.trim(),
          address: address.trim(),
          postalCode: postalCode.trim() || undefined,
          city: city.trim() || undefined,
          ownerName: ownerName.trim() || undefined,
          ownerBirthDate: ownerBirthDate.trim() || undefined,
          ownerPhone: ownerPhone.trim() || undefined,
          residentName: residentName.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Kunne ikke lagre');
      }

      toast.success('Besøk registrert');
      router.push('/tekniker/besok');
    } catch (err: any) {
      toast.error(err.message || 'Noe gikk galt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Nytt besøk</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700">Adresse</h2>
          <Input
            label="Leilighet *"
            placeholder="f.eks. h0101"
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
          />
          <Input
            label="Adresse *"
            placeholder="f.eks. Margarethas vei 2"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Postnr"
              placeholder="1473"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
            <Input
              label="Sted"
              placeholder="Lørenskog"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </Card>

        <Card className="space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700">Eier</h2>
          <Input
            label="Navn"
            placeholder="Sander Bjertnes"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Født"
              placeholder="23.11.1990"
              value={ownerBirthDate}
              onChange={(e) => setOwnerBirthDate(e.target.value)}
            />
            <Input
              label="Telefon"
              placeholder="47266383"
              type="tel"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
            />
          </div>
        </Card>

        <Card className="space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700">Beboer</h2>
          <Input
            label="Navn"
            placeholder="Jonas Solvang"
            value={residentName}
            onChange={(e) => setResidentName(e.target.value)}
          />
        </Card>

        <Card className="space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700">Notat</h2>
          <textarea
            className="input-field min-h-[80px]"
            placeholder="Eventuelle notater..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Card>

        <Button type="submit" fullWidth isLoading={saving}>
          Registrer besøk
        </Button>
      </form>
    </div>
  );
}
