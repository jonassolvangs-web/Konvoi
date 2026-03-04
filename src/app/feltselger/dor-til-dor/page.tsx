'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, DoorOpen, CheckCircle, XCircle, Home, PlusCircle } from 'lucide-react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import StatCard from '@/components/ui/stat-card';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import LoadingSpinner from '@/components/ui/loading-spinner';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

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
  };
  _count: { dwellingUnits: number };
}

interface Organization {
  id: string;
  name: string;
  address: string;
  numUnits: number;
}

export default function DorTilDorPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Organization[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualPostal, setManualPostal] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualName, setManualName] = useState('');

  useEffect(() => {
    async function fetchVisits() {
      try {
        const res = await fetch('/api/visits');
        const data = await res.json();
        const doorVisits = (data.visits || []).filter((v: Visit) => v.source === 'dor_til_dor');
        setVisits(doorVisits);
      } catch {
        setVisits([]);
      } finally {
        setLoading(false);
      }
    }
    fetchVisits();
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/organizations?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.organizations || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateVisit = async (orgId: string) => {
    setCreating(true);
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          source: 'dor_til_dor',
        }),
      });
      const data = await res.json();
      toast.success('Besøk opprettet');
      setShowModal(false);
      setSearchQuery('');
      setSearchResults([]);
      router.push(`/feltselger/besok/${data.visit.id}`);
    } catch {
      toast.error('Kunne ikke opprette besøk');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateManual = async () => {
    if (!manualAddress) {
      toast.error('Skriv inn en adresse');
      return;
    }
    setCreating(true);
    try {
      // Create organization first
      const orgRes = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualName || manualAddress,
          address: manualAddress,
          postalCode: manualPostal || undefined,
          city: manualCity || undefined,
          numUnits: 1,
        }),
      });
      const orgData = await orgRes.json();
      if (!orgRes.ok) throw new Error(orgData.error);

      // Create visit for the new organization
      const visitRes = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgData.organization.id,
          source: 'dor_til_dor',
        }),
      });
      const visitData = await visitRes.json();

      toast.success('Adresse og besøk opprettet');
      setShowModal(false);
      setShowManualForm(false);
      setManualAddress('');
      setManualPostal('');
      setManualCity('');
      setManualName('');
      setSearchQuery('');
      setSearchResults([]);
      router.push(`/feltselger/besok/${visitData.visit.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke opprette adresse');
    } finally {
      setCreating(false);
    }
  };

  const todayVisits = visits.filter((v) => {
    const d = new Date(v.createdAt);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
  });

  const totalSold = visits.reduce((sum, v) => sum + (v.unitsSold || 0), 0);
  const todaySold = todayVisits.reduce((sum, v) => sum + (v.unitsSold || 0), 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container relative min-h-screen">
      <h1 className="page-title mb-4">Dør-til-dør</h1>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <StatCard
          icon={DoorOpen}
          value={todayVisits.length}
          label="I dag"
          color="bg-blue-50"
        />
        <StatCard
          icon={CheckCircle}
          value={todaySold}
          label="Solgt i dag"
          color="bg-green-50"
        />
        <StatCard
          icon={Home}
          value={totalSold}
          label="Totalt solgt"
          color="bg-purple-50"
        />
      </div>

      {/* Visit list */}
      {visits.length === 0 ? (
        <EmptyState
          title="Ingen dør-til-dør besøk"
          description="Trykk + for å registrere et nytt besøk"
        />
      ) : (
        <div className="space-y-2">
          {visits.map((visit) => (
            <Card
              key={visit.id}
              hover
              onClick={() => router.push(`/feltselger/besok/${visit.id}`)}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold">{visit.organization.name}</h3>
                <StatusBadge type="visit" status={visit.status} />
              </div>
              <p className="text-xs text-gray-500 mb-2">{visit.organization.address}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{formatDate(visit.createdAt)}</span>
                <span>{visit._count.dwellingUnits} enheter</span>
                {visit.unitsSold > 0 && (
                  <span className="text-green-600 font-medium">{visit.unitsSold} solgt</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-24 right-4 h-14 w-14 bg-black text-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-800 transition-colors z-30"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Registration modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setShowManualForm(false); }} title="Nytt dør-til-dør besøk">
        <div className="space-y-4">
          {!showManualForm ? (
            <>
              <Input
                label="Søk etter eksisterende adresse"
                placeholder="Navn eller adresse..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />

              {searching && <LoadingSpinner size="sm" />}

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((org) => (
                    <Card
                      key={org.id}
                      hover
                      padding="sm"
                      onClick={() => handleCreateVisit(org.id)}
                    >
                      <p className="text-sm font-semibold">{org.name}</p>
                      <p className="text-xs text-gray-500">{org.address}</p>
                      <p className="text-xs text-gray-400">{org.numUnits} enheter</p>
                    </Card>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Ingen resultater funnet</p>
              )}

              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={() => setShowManualForm(true)}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <PlusCircle className="h-5 w-5" />
                  <span>Legg til ny adresse manuelt</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">Legg til en enkeltadresse (f.eks. hus, rekkehus)</p>
              <Input
                label="Adresse"
                placeholder="Gydas gate 16"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Postnr."
                  placeholder="3732"
                  value={manualPostal}
                  onChange={(e) => setManualPostal(e.target.value)}
                />
                <Input
                  label="Sted"
                  placeholder="Skien"
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                />
              </div>
              <Input
                label="Navn (valgfritt)"
                placeholder="Beboernavn eller beskrivelse"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowManualForm(false)} fullWidth>
                  Tilbake
                </Button>
                <Button onClick={handleCreateManual} isLoading={creating} fullWidth disabled={!manualAddress}>
                  Opprett besøk
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
