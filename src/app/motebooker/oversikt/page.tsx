'use client';

import { useEffect, useState, useCallback } from 'react';
import SearchBar from '@/components/ui/search-bar';
import FilterChips from '@/components/ui/filter-chips';
import Card from '@/components/ui/card';
import StatusBadge from '@/components/ui/status-badge';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { orgStatusConfig, formatDistance, formatDateTime } from '@/lib/utils';
import { Phone, Clock } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  address: string;
  status: string;
  numUnits: number | null;
  chairmanName: string | null;
  chairmanPhone: string | null;
  distanceFromOfficeKm: number | null;
  distanceFromOfficeMin: number | null;
  lastContactedAt: string | null;
}

interface Callback {
  id: string;
  callbackAt: string;
  organization: { name: string; address: string };
}

export default function OversiktPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [orgRes, callRes] = await Promise.all([
        fetch('/api/organizations?limit=500'),
        fetch('/api/calls'),
      ]);
      const orgData = await orgRes.json();
      const callData = await callRes.json();

      setOrganizations(orgData.organizations || []);

      // Extract callbacks (calls with callbackAt in the future)
      const now = new Date();
      const pendingCallbacks = (callData.calls || [])
        .filter((c: any) => c.result === 'ring_tilbake' && c.callbackAt && new Date(c.callbackAt) > now)
        .map((c: any) => ({
          id: c.id,
          callbackAt: c.callbackAt,
          organization: c.organization,
        }));
      setCallbacks(pendingCallbacks);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusChips = [
    { id: 'alle', label: 'Alle', count: organizations.length },
    ...Object.entries(orgStatusConfig).map(([id, config]) => ({
      id,
      label: config.label,
      count: organizations.filter((o) => o.status === id).length,
    })),
  ];

  const filtered = organizations.filter((org) => {
    const matchesSearch =
      !search ||
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.address.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'alle' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <h1 className="page-title mb-4">Oversikt</h1>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Søk sameie eller adresse..."
        className="mb-3"
      />

      <FilterChips
        chips={statusChips}
        activeChip={statusFilter}
        onChange={setStatusFilter}
        className="mb-4"
      />

      {/* Callbacks section */}
      {callbacks.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            Ring tilbake ({callbacks.length})
          </h2>
          <div className="space-y-2">
            {callbacks.map((cb) => (
              <Card key={cb.id} padding="sm" hover>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{cb.organization.name}</p>
                    <p className="text-xs text-gray-500">{cb.organization.address}</p>
                  </div>
                  <Badge color="bg-yellow-100 text-yellow-700">
                    {formatDateTime(cb.callbackAt)}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Organization list */}
      {filtered.length === 0 ? (
        <EmptyState title="Ingen sameier funnet" description="Prøv å endre søk eller filter" />
      ) : (
        <div className="space-y-2">
          {filtered.map((org) => (
            <Card key={org.id} padding="sm" hover>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold truncate">{org.name}</p>
                    <StatusBadge type="organization" status={org.status} />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{org.address}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {org.numUnits && (
                      <span className="text-xs text-gray-400">{org.numUnits} enheter</span>
                    )}
                    {org.distanceFromOfficeKm && (
                      <span className="text-xs text-green-600">
                        {formatDistance(org.distanceFromOfficeKm, org.distanceFromOfficeMin || 0)}
                      </span>
                    )}
                  </div>
                </div>
                {org.chairmanPhone && (
                  <a
                    href={`tel:${org.chairmanPhone}`}
                    className="ml-2 p-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <Phone className="h-4 w-4 text-green-600" />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
