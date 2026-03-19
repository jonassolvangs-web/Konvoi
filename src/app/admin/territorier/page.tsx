'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trash2, MapPin, Users } from 'lucide-react';
import Button from '@/components/ui/button';
import Select from '@/components/ui/select';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import LoadingSpinner from '@/components/ui/loading-spinner';
import TerritoryMap from '@/components/map/territory-map';
import { TERRITORY_COLORS } from '@/lib/constants';
import toast from 'react-hot-toast';

interface Territory {
  id: string;
  name: string;
  color: string;
  polygon: { type: string; coordinates: number[][][] };
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
}

interface Organization {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  assignedToId: string | null;
}

interface UserItem {
  id: string;
  name: string;
  roles: string;
}

export default function TerritorierPage() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  // New territory modal
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TERRITORY_COLORS[0]);
  const [pendingPolygon, setPendingPolygon] = useState<number[][][] | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [tRes, oRes, uRes] = await Promise.all([
      fetch('/api/territories').then((r) => r.json()),
      fetch('/api/organizations?limit=5000').then((r) => r.json()),
      fetch('/api/admin/users').then((r) => r.json()),
    ]);
    setTerritories(tRes.territories || []);
    setOrganizations(oRes.organizations || []);
    setUsers(uRes.users || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedTerritory = territories.find((t) => t.id === selectedId) || null;

  // Count orgs inside each territory (approximate – just by assignedToId match)
  const orgCountByTerritory = (t: Territory) => {
    if (!t.assignedToId) return 0;
    return organizations.filter((o) => o.assignedToId === t.assignedToId).length;
  };

  const handlePolygonCreated = (coordinates: number[][][]) => {
    setPendingPolygon(coordinates);
    setShowNew(true);
  };

  const handleSaveTerritory = async () => {
    if (!newName.trim() || !pendingPolygon) return;
    setSaving(true);
    try {
      const res = await fetch('/api/territories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          color: newColor,
          polygon: { type: 'Polygon', coordinates: pendingPolygon },
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success('Revir opprettet');
      setShowNew(false);
      setNewName('');
      setPendingPolygon(null);
      setSelectedId(data.territory.id);
      fetchData();
    } catch {
      toast.error('Kunne ikke opprette revir');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignUser = async (territoryId: string, userId: string | null) => {
    try {
      const res = await fetch(`/api/territories/${territoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: userId || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Selger oppdatert');
      fetchData();
    } catch {
      toast.error('Kunne ikke oppdatere');
    }
  };

  const handleDelete = async (territoryId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette reviret?')) return;
    try {
      const res = await fetch(`/api/territories/${territoryId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Revir slettet');
      setSelectedId(null);
      fetchData();
    } catch {
      toast.error('Kunne ikke slette');
    }
  };

  const handleAssignAddresses = async (territoryId?: string) => {
    setAssigning(true);
    try {
      const body = territoryId ? { territoryId } : { all: true };
      const res = await fetch('/api/territories/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Feil');
      toast.success(`${data.count} adresser tildelt`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke tildele adresser');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen flex flex-col md:flex-row">
      {/* Left panel – territory list */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-200 overflow-y-auto bg-white flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h1 className="page-title mb-3">Revir</h1>
          <p className="text-xs text-gray-500 mb-3">Tegn et polygon på kartet for å opprette et nytt revir.</p>
          <Button
            size="sm"
            variant="secondary"
            fullWidth
            onClick={() => handleAssignAddresses()}
            isLoading={assigning}
          >
            <MapPin className="h-4 w-4" />
            Tildel alle adresser
          </Button>
        </div>

        <div className="divide-y divide-gray-100">
          {territories.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
              className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                t.id === selectedId ? 'bg-gray-50 border-l-4' : 'border-l-4 border-transparent'
              }`}
              style={t.id === selectedId ? { borderLeftColor: t.color } : undefined}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ background: t.color }}
                />
                <span className="text-sm font-semibold truncate">{t.name}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {t.assignedTo ? (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {t.assignedTo.name}
                  </span>
                ) : (
                  <span className="text-gray-400">Ingen selger</span>
                )}
                <span>{orgCountByTerritory(t)} adresser</span>
              </div>
            </button>
          ))}
          {territories.length === 0 && (
            <div className="p-4 text-sm text-gray-400 text-center">
              Ingen revir ennå. Tegn et polygon på kartet.
            </div>
          )}
        </div>

        {/* Selected territory detail panel */}
        {selectedTerritory && (
          <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
            <h3 className="text-sm font-semibold">{selectedTerritory.name}</h3>
            <Select
              label="Tildelt selger"
              placeholder="Velg selger..."
              value={selectedTerritory.assignedToId || ''}
              onChange={(e) => handleAssignUser(selectedTerritory.id, e.target.value || null)}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
            <Button
              size="sm"
              variant="secondary"
              fullWidth
              onClick={() => handleAssignAddresses(selectedTerritory.id)}
              isLoading={assigning}
              disabled={!selectedTerritory.assignedToId}
            >
              <MapPin className="h-4 w-4" />
              Tildel adresser i dette reviret
            </Button>
            <Button
              size="sm"
              variant="danger"
              fullWidth
              onClick={() => handleDelete(selectedTerritory.id)}
            >
              <Trash2 className="h-4 w-4" />
              Slett revir
            </Button>
          </div>
        )}
      </div>

      {/* Right panel – map */}
      <div className="flex-1 min-h-[300px]">
        <TerritoryMap
          territories={territories}
          organizations={organizations}
          selectedTerritoryId={selectedId}
          onSelectTerritory={setSelectedId}
          onPolygonCreated={handlePolygonCreated}
        />
      </div>

      {/* New territory modal */}
      <Modal isOpen={showNew} onClose={() => { setShowNew(false); setPendingPolygon(null); }} title="Nytt revir">
        <div className="space-y-4">
          <Input
            label="Navn"
            placeholder="F.eks. Oslo Vest"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div>
            <label className="label">Farge</label>
            <div className="flex gap-2 flex-wrap">
              {TERRITORY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    newColor === c ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <Button
            fullWidth
            onClick={handleSaveTerritory}
            isLoading={saving}
            disabled={!newName.trim()}
          >
            Opprett revir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
