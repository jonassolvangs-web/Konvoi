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
}

// Pipeline-stage based marker config
const markerConfig: Record<string, { emoji: string; bg: string }> = {
  ikke_ringt:      { emoji: '☎️', bg: '#6B7280' },
  ringt_folg_opp:  { emoji: '📞', bg: '#EAB308' },
  venter:          { emoji: '⏳', bg: '#F97316' },
  videresendt:     { emoji: '✅', bg: '#3B82F6' },
  klar:            { emoji: '🎯', bg: '#111827' },
};

// Cache icons to prevent re-creation on zoom/re-render
const iconCache: Record<string, L.DivIcon> = {};

function createEmojiIcon(markerType: string) {
  if (iconCache[markerType]) return iconCache[markerType];
  const config = markerConfig[markerType] || markerConfig.ikke_ringt;
  const icon = L.divIcon({
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
  iconCache[markerType] = icon;
  return icon;
}

function getMarkerType(org: Organization, orgMarkerTypes?: Record<string, string>): string {
  if (orgMarkerTypes && orgMarkerTypes[org.id]) {
    return orgMarkerTypes[org.id];
  }
  return 'ikke_ringt';
}

export default function MapView({ organizations, statusFilter, onSelectOrg, orgMarkerTypes }: MapViewProps) {
  const filtered = organizations.filter((org) => {
    if (!org.latitude || !org.longitude) return false;
    if (statusFilter !== 'alle') {
      const matchMarker = orgMarkerTypes && orgMarkerTypes[org.id] === statusFilter;
      if (!matchMarker) return false;
    }
    return true;
  });

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
    <MapContainer
      center={[59.9139, 10.7522]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      markerZoomAnimation={false}
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
