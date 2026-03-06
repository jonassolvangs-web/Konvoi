'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Shuffle, PlusCircle, MapPin } from 'lucide-react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import SearchBar from '@/components/ui/search-bar';
import FilterChips from '@/components/ui/filter-chips';
import StatusBadge from '@/components/ui/status-badge';
import Modal from '@/components/ui/modal';
import Select from '@/components/ui/select';
import Input from '@/components/ui/input';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { formatDistance } from '@/lib/utils';
import toast from 'react-hot-toast';

const statusFilters = [
  { id: 'alle', label: 'Alle' },
  { id: 'ikke_tildelt', label: 'Ikke tildelt' },
  { id: 'tildelt', label: 'Tildelt' },
  { id: 'mote_booket', label: 'Møte booket' },
  { id: 'besok_pagaar', label: 'Besøk pågår' },
  { id: 'venter_tekniker', label: 'Venter tekniker' },
  { id: 'fullfort', label: 'Fullført' },
];

export default function AdresserPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [showAssign, setShowAssign] = useState(false);
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [saving, setSaving] = useState(false);

  // Manual address state
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualPostal, setManualPostal] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualChairmanName, setManualChairmanName] = useState('');
  const [manualChairmanPhone, setManualChairmanPhone] = useState('');
  const [manualChairmanEmail, setManualChairmanEmail] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualAssignTo, setManualAssignTo] = useState('');
  const [addingAddress, setAddingAddress] = useState(false);

  const fetchData = async () => {
    const [orgRes, userRes] = await Promise.all([
      fetch('/api/organizations').then((r) => r.json()),
      fetch('/api/admin/users').then((r) => r.json()),
    ]);
    setOrgs(orgRes.organizations || []);
    setUsers(userRes.users || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = orgs.filter((org) => {
    const matchSearch = org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.address.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'alle' || org.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleSelect = (id: string) => {
    setSelectedOrgs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAssign = async () => {
    if (!assignUserId || selectedOrgs.length === 0) {
      toast.error('Velg bruker og adresser');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/organizations/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationIds: selectedOrgs, userId: assignUserId }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${selectedOrgs.length} adresser tildelt`);
      setShowAssign(false);
      setSelectedOrgs([]);
      fetchData();
    } catch {
      toast.error('Kunne ikke tildele');
    } finally {
      setSaving(false);
    }
  };

  const handleDistribute = async () => {
    const motebookers = users.filter((u) => u.roles.includes('MOTEBOOKER'));
    if (motebookers.length === 0) {
      toast.error('Ingen møtebookere tilgjengelig');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/organizations/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: motebookers.map((u: any) => u.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.count} adresser fordelt jevnt`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke fordele');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async () => {
    if (!manualAddress.trim()) {
      toast.error('Skriv inn en adresse');
      return;
    }
    setAddingAddress(true);
    try {
      const fullAddress = [manualAddress.trim(), manualPostal.trim(), manualCity.trim()].filter(Boolean).join(', ');
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualChairmanName.trim() || fullAddress,
          address: manualAddress.trim(),
          postalCode: manualPostal.trim() || undefined,
          city: manualCity.trim() || undefined,
          numUnits: 1,
          chairmanName: manualChairmanName.trim() || undefined,
          chairmanPhone: manualChairmanPhone.trim() || undefined,
          chairmanEmail: manualChairmanEmail.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();

      const data = await res.json();
      if (data.organization?.id) {
        const updateData: any = {};
        if (manualAssignTo) updateData.assignedToId = manualAssignTo;
        if (manualNote.trim()) updateData.notes = manualNote.trim();
        if (manualAssignTo) updateData.status = 'tildelt';
        if (Object.keys(updateData).length > 0) {
          await fetch(`/api/organizations/${data.organization.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          });
        }
      }

      toast.success('Adresse lagt til');
      setShowAddAddress(false);
      setManualAddress('');
      setManualPostal('');
      setManualCity('');
      setManualChairmanName('');
      setManualChairmanPhone('');
      setManualChairmanEmail('');
      setManualNote('');
      setManualAssignTo('');
      fetchData();
    } catch {
      toast.error('Kunne ikke legge til adresse');
    } finally {
      setAddingAddress(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Adresser ({filtered.length})</h1>
        <div className="flex gap-2">
          {selectedOrgs.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setShowAssign(true)}>
              <UserPlus className="h-4 w-4" />
              Tildel ({selectedOrgs.length})
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={handleDistribute} isLoading={saving}>
            <Shuffle className="h-4 w-4" />
            Fordel jevnt
          </Button>
          <Button size="sm" onClick={() => setShowAddAddress(true)}>
            <PlusCircle className="h-4 w-4" />
            Legg til
          </Button>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Søk adresser..." className="mb-3" />
      <FilterChips chips={statusFilters} activeChip={statusFilter} onChange={setStatusFilter} className="mb-4" />

      <div className="space-y-2">
        {filtered.map((org) => (
          <Card
            key={org.id}
            padding="sm"
            hover
            onClick={() => toggleSelect(org.id)}
            className={selectedOrgs.includes(org.id) ? 'border-black' : ''}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedOrgs.includes(org.id)}
                onChange={() => toggleSelect(org.id)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 rounded border-gray-300"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{org.name}</p>
                  <StatusBadge type="organization" status={org.status} />
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-gray-500">{org.address}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const query = org.latitude && org.longitude
                        ? `${org.latitude},${org.longitude}`
                        : encodeURIComponent(`${org.address}${org.city ? ', ' + org.city : ''}`);
                      window.open(`https://maps.google.com/?q=${query}`, '_blank');
                    }}
                    className="p-1 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0"
                    aria-label="Åpne i Google Maps"
                  >
                    <MapPin className="h-3.5 w-3.5 text-blue-500" />
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {org.numUnits && <span>{org.numUnits} enheter</span>}
                  {org.distanceFromOfficeKm && (
                    <span>{formatDistance(org.distanceFromOfficeKm, org.distanceFromOfficeMin || 0)}</span>
                  )}
                  {org.assignedTo && <span>Tildelt: {org.assignedTo.name}</span>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Tildel adresser">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{selectedOrgs.length} adresser valgt</p>
          <Select
            label="Tildel til"
            placeholder="Velg bruker..."
            value={assignUserId}
            onChange={(e) => setAssignUserId(e.target.value)}
            options={users.map((u) => ({ value: u.id, label: u.name }))}
          />
          <Button onClick={handleAssign} isLoading={saving} fullWidth>
            Tildel
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showAddAddress} onClose={() => setShowAddAddress(false)} title="Legg til adresse manuelt">
        <div className="space-y-3">
          <Input
            label="Adresse *"
            placeholder="F.eks. Gydas gate 16"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Postnummer"
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
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Kontaktperson</p>
            <div className="space-y-3">
              <Input
                label="Navn"
                placeholder="Ola Nordmann"
                value={manualChairmanName}
                onChange={(e) => setManualChairmanName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Telefon"
                  type="tel"
                  placeholder="900 00 000"
                  value={manualChairmanPhone}
                  onChange={(e) => setManualChairmanPhone(e.target.value)}
                />
                <Input
                  label="E-post"
                  type="email"
                  placeholder="ola@example.no"
                  value={manualChairmanEmail}
                  onChange={(e) => setManualChairmanEmail(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Notat</label>
            <textarea
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              rows={2}
              placeholder="F.eks. gammel ventilasjon, snakket med på døra..."
              className="input-field w-full resize-none"
            />
          </div>
          <div className="border-t border-gray-100 pt-3">
            <Select
              label="Tildel til møtebooker"
              placeholder="Ikke tildelt"
              value={manualAssignTo}
              onChange={(e) => setManualAssignTo(e.target.value)}
              options={users
                .filter((u) => u.roles?.includes('MOTEBOOKER'))
                .map((u) => ({ value: u.id, label: u.name }))}
            />
          </div>
          <Button
            fullWidth
            onClick={handleAddAddress}
            isLoading={addingAddress}
            disabled={!manualAddress.trim()}
          >
            Legg til adresse
          </Button>
        </div>
      </Modal>
    </div>
  );
}
