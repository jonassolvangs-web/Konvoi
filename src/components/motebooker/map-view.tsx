'use client';

import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Organization {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  numUnits: number | null;
  buildingYear: number | null;
  chairmanName: string | null;
  chairmanPhone: string | null;
  chairmanEmail: string | null;
  distanceFromOfficeKm: number | null;
  distanceFromOfficeMin: number | null;
  assignedToId: string | null;
  notes: string | null;
}

interface MapViewProps {
  organizations: Organization[];
  statusFilter: string;
  onSelectOrg: (org: Organization) => void;
  orgMarkerTypes?: Record<string, string>; // orgId -> markerType
  buildYearFilter?: string;   // 'alle' | 'pre1970' | '1970-1990' | 'post1990'
  unitsFilter?: string;       // 'alle' | 'under25' | '25-50' | 'over50'
  onBuildYearFilterChange?: (v: string) => void;
  onUnitsFilterChange?: (v: string) => void;
}

// markerType -> emoji + background color
const markerConfig: Record<string, { emoji: string; bg: string }> = {
  ikke_kontaktet:  { emoji: '📍', bg: '#9CA3AF' },    // Gray - uncontacted
  ingen_svar:      { emoji: '❄️', bg: '#9CA3AF' },    // Gray - no answer
  callback:        { emoji: '📞', bg: '#F59E0B' },    // Amber - callback
  mail_sendt:      { emoji: '✉️', bg: '#8B5CF6' },    // Purple - mail sent
  mote_booket:     { emoji: '📅', bg: '#3B82F6' },    // Blue - meeting booked
  nei:             { emoji: '🚫', bg: '#EF4444' },    // Red - declined
  besok_pagaar:    { emoji: '🔶', bg: '#F59E0B' },    // Yellow - visit in progress
  venter_tekniker: { emoji: '🔧', bg: '#F97316' },    // Orange - waiting technician
  rens_pagaar:     { emoji: '⚡', bg: '#EAB308' },     // Yellow - cleaning in progress
  fullfort:        { emoji: '✅', bg: '#22C55E' },     // Green - completed
};

function createEmojiIcon(markerType: string) {
  const config = markerConfig[markerType] || markerConfig.ikke_kontaktet;
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: ${config.bg};
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      line-height: 1;
    ">${config.emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function getMarkerType(org: Organization, orgMarkerTypes?: Record<string, string>): string {
  // If we have call-based marker info, use it
  if (orgMarkerTypes && orgMarkerTypes[org.id]) {
    return orgMarkerTypes[org.id];
  }

  // Fall back to org status
  if (org.status === 'mote_booket') return 'mote_booket';
  if (org.status === 'fullfort') return 'mote_booket';

  return 'ikke_kontaktet';
}

const buildYearOptions = [
  { id: 'alle', label: 'Alle' },
  { id: 'pre1970', label: 'Før 1970' },
  { id: '1970-1990', label: '1970–1990' },
  { id: 'post1990', label: 'Etter 1990' },
];

const unitsOptions = [
  { id: 'alle', label: 'Alle' },
  { id: 'under25', label: 'Under 25' },
  { id: '25-50', label: '25–50' },
  { id: 'over50', label: 'Over 50' },
];

export default function MapView({ organizations, statusFilter, onSelectOrg, orgMarkerTypes, buildYearFilter = 'alle', unitsFilter = 'alle', onBuildYearFilterChange, onUnitsFilterChange }: MapViewProps) {
  const filtered = organizations.filter((org) => {
    if (!org.latitude || !org.longitude) return false;
    if (statusFilter !== 'alle') {
      const matchStatus = org.status === statusFilter;
      const matchMarker = orgMarkerTypes && orgMarkerTypes[org.id] === statusFilter;
      const matchGroup = statusFilter === 'venter_tekniker' && (org.status === 'besok_pagaar' || org.status === 'rens_pagaar');
      if (!matchStatus && !matchMarker && !matchGroup) return false;
    }
    if (buildYearFilter !== 'alle' && org.buildingYear) {
      if (buildYearFilter === 'pre1970' && org.buildingYear >= 1970) return false;
      if (buildYearFilter === '1970-1990' && (org.buildingYear < 1970 || org.buildingYear > 1990)) return false;
      if (buildYearFilter === 'post1990' && org.buildingYear <= 1990) return false;
    }
    if (unitsFilter !== 'alle' && org.numUnits) {
      if (unitsFilter === 'under25' && org.numUnits >= 25) return false;
      if (unitsFilter === '25-50' && (org.numUnits < 25 || org.numUnits > 50)) return false;
      if (unitsFilter === 'over50' && org.numUnits <= 50) return false;
    }
    return true;
  });

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* Filter buttons */}
      {(onBuildYearFilterChange || onUnitsFilterChange) && (
        <div className="absolute top-3 left-3 right-3 z-[1000] space-y-2">
          {onBuildYearFilterChange && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <span className="shrink-0 text-[10px] font-semibold text-gray-500 uppercase self-center mr-1">Byggeår</span>
              {buildYearOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onBuildYearFilterChange(opt.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors backdrop-blur-sm ${
                    buildYearFilter === opt.id
                      ? 'bg-black text-white'
                      : 'bg-white/80 text-gray-700 hover:bg-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {onUnitsFilterChange && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <span className="shrink-0 text-[10px] font-semibold text-gray-500 uppercase self-center mr-1">Enheter</span>
              {unitsOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onUnitsFilterChange(opt.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors backdrop-blur-sm ${
                    unitsFilter === opt.id
                      ? 'bg-black text-white'
                      : 'bg-white/80 text-gray-700 hover:bg-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    <MapContainer
      center={[59.9139, 10.7522]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Esri"
        maxZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      {filtered.map((org) => (
        <Marker
          key={org.id}
          position={[org.latitude!, org.longitude!]}
          icon={createEmojiIcon(getMarkerType(org, orgMarkerTypes))}
          eventHandlers={{ click: () => onSelectOrg(org) }}
        />
      ))}
    </MapContainer>
    </div>
  );
}
