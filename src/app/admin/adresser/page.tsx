'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Shuffle } from 'lucide-react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import SearchBar from '@/components/ui/search-bar';
import FilterChips from '@/components/ui/filter-chips';
import StatusBadge from '@/components/ui/status-badge';
import Modal from '@/components/ui/modal';
import Select from '@/components/ui/select';
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
                <p className="text-xs text-gray-500">{org.address}</p>
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
    </div>
  );
}
