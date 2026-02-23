'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Building2, MapPin, Shield, HelpCircle, LogOut, RefreshCw, Camera } from 'lucide-react';
import Avatar from '@/components/ui/avatar';
import Badge from '@/components/ui/badge';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import AddressAutocomplete from '@/components/ui/address-autocomplete';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { getRoleLabel } from '@/lib/utils';
import { SETTING_KEYS } from '@/lib/constants';
import toast from 'react-hot-toast';

export default function InnstillingerPage() {
  const { data: session, update } = useSession();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [showRecalculate, setShowRecalculate] = useState(false);
  const [geocodingMissing, setGeocodingMissing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/users/${(session?.user as any)?.id}/profile-image`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await update({ profileImageUrl: data.profileImageUrl });
      toast.success('Profilbilde oppdatert');
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke laste opp bilde');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => setSettings(d.settings || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateSetting = (key: string, value: string) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (data.geocoded) {
        setSettings((s) => ({
          ...s,
          [SETTING_KEYS.OFFICE_LAT]: String(data.geocoded.lat),
          [SETTING_KEYS.OFFICE_LON]: String(data.geocoded.lon),
        }));
        setShowRecalculate(true);
        toast.success('Innstillinger lagret – koordinater oppdatert');
      } else {
        toast.success('Innstillinger lagret');
      }
    } catch {
      toast.error('Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch('/api/admin/recalculate-distances', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`${data.updatedCount} avstander rekalkulert`);
      setShowRecalculate(false);
    } catch {
      toast.error('Kunne ikke rekalkulere avstander');
    } finally {
      setRecalculating(false);
    }
  };

  const handleAddressSelect = (address: string, postalCode: string, city: string, lat: number, lon: number) => {
    setSettings((s) => ({
      ...s,
      [SETTING_KEYS.OFFICE_STREET]: address,
      [SETTING_KEYS.OFFICE_POSTAL_CODE]: postalCode,
      [SETTING_KEYS.OFFICE_CITY]: city,
      [SETTING_KEYS.OFFICE_LAT]: String(lat),
      [SETTING_KEYS.OFFICE_LON]: String(lon),
    }));
    setShowRecalculate(true);
  };

  const handleGeocodeMissing = async () => {
    setGeocodingMissing(true);
    try {
      const res = await fetch('/api/admin/geocode-missing', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`${data.geocoded} av ${data.total} adresser geokodet`);
    } catch {
      toast.error('Kunne ikke geokode adresser');
    } finally {
      setGeocodingMissing(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const userName = session?.user?.name || '';
  const userRoles = ((session?.user as any)?.roles || []) as string[];
  const officeLat = settings[SETTING_KEYS.OFFICE_LAT];
  const officeLon = settings[SETTING_KEYS.OFFICE_LON];

  return (
    <div className="page-container">
      <h1 className="page-title mb-6">Innstillinger</h1>

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group flex-shrink-0"
          >
            <Avatar name={userName} imageUrl={(session?.user as any)?.profileImageUrl} size="lg" />
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div>
            <p className="font-semibold">{userName}</p>
            <p className="text-sm text-gray-500">{session?.user?.email}</p>
            <div className="flex gap-1 mt-1">
              {userRoles.map((r) => (
                <Badge key={r} size="sm" color="bg-gray-100 text-gray-700">{getRoleLabel(r)}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-gray-400" />
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Firmainnstillinger</h2>
        </div>
        <Card>
          <div className="space-y-4">
            <Input label="Firmanavn" value={settings[SETTING_KEYS.COMPANY_NAME] || ''} onChange={(e) => updateSetting(SETTING_KEYS.COMPANY_NAME, e.target.value)} />
            <Input label="Org.nummer" value={settings[SETTING_KEYS.COMPANY_ORG_NUMBER] || ''} onChange={(e) => updateSetting(SETTING_KEYS.COMPANY_ORG_NUMBER, e.target.value)} />
            <Input label="Telefon" value={settings[SETTING_KEYS.COMPANY_PHONE] || ''} onChange={(e) => updateSetting(SETTING_KEYS.COMPANY_PHONE, e.target.value)} />
            <Input label="E-post" value={settings[SETTING_KEYS.COMPANY_EMAIL] || ''} onChange={(e) => updateSetting(SETTING_KEYS.COMPANY_EMAIL, e.target.value)} />
          </div>
        </Card>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-gray-400" />
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kontoradresse</h2>
        </div>
        <Card>
          <div className="space-y-4">
            <AddressAutocomplete
              label="Kontoradresse"
              value={settings[SETTING_KEYS.OFFICE_STREET] || ''}
              onChange={(val) => updateSetting(SETTING_KEYS.OFFICE_STREET, val)}
              onSelect={handleAddressSelect}
              placeholder="Søk etter adresse..."
            />
            {settings[SETTING_KEYS.OFFICE_POSTAL_CODE] && (
              <p className="text-sm text-gray-600">
                {settings[SETTING_KEYS.OFFICE_POSTAL_CODE]} {settings[SETTING_KEYS.OFFICE_CITY]}
              </p>
            )}
            {officeLat && officeLon && (
              <p className="text-xs text-gray-400">
                Koordinater: {officeLat}, {officeLon}
              </p>
            )}
            <Input label="Rens-intervall (år)" type="number" value={settings[SETTING_KEYS.CLEANING_INTERVAL_YEARS] || '3'} onChange={(e) => updateSetting(SETTING_KEYS.CLEANING_INTERVAL_YEARS, e.target.value)} />
          </div>
        </Card>
      </div>

      <Button onClick={handleSave} isLoading={saving} fullWidth className="mb-4">
        Lagre innstillinger
      </Button>

      {showRecalculate && (
        <Button onClick={handleRecalculate} isLoading={recalculating} fullWidth variant="secondary" className="mb-6">
          <RefreshCw className="h-4 w-4 mr-2" />
          Rekalkuler avstander for alle sameier
        </Button>
      )}

      <Button onClick={handleGeocodeMissing} isLoading={geocodingMissing} fullWidth variant="secondary" className="mb-4">
        <MapPin className="h-4 w-4 mr-2" />
        Geokod manglende adresser
      </Button>

      {!showRecalculate && <div className="mb-2" />}

      <div className="space-y-2">
        <Card hover className="flex items-center gap-3 cursor-pointer">
          <Shield className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium">Sikkerhet</span>
        </Card>
        <Card hover className="flex items-center gap-3 cursor-pointer">
          <HelpCircle className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium">Hjelp</span>
        </Card>
        <button onClick={() => signOut({ callbackUrl: '/auth/login' })} className="w-full">
          <Card className="flex items-center gap-3 text-red-500">
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">Logg ut</span>
          </Card>
        </button>
      </div>
    </div>
  );
}
