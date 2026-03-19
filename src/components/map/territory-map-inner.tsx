'use client';

import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { EditControl } from 'react-leaflet-draw';

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

interface TerritoryMapInnerProps {
  territories: Territory[];
  organizations: Organization[];
  selectedTerritoryId: string | null;
  onSelectTerritory: (id: string | null) => void;
  onPolygonCreated: (coordinates: number[][][]) => void;
}

// Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng]
function geoToLeaflet(coords: number[][]): [number, number][] {
  return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
}

// Convert Leaflet [lat, lng] to GeoJSON [lng, lat]
function leafletToGeo(latlngs: L.LatLng[]): number[][] {
  const coords = latlngs.map((ll) => [ll.lng, ll.lat]);
  // Close the ring if not already closed
  if (coords.length > 0) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([...first]);
    }
  }
  return coords;
}

export default function TerritoryMapInner({
  territories,
  organizations,
  selectedTerritoryId,
  onSelectTerritory,
  onPolygonCreated,
}: TerritoryMapInnerProps) {
  const handleCreated = (e: any) => {
    const layer = e.layer;
    const latlngs = layer.getLatLngs()[0]; // First ring
    const geoCoords = leafletToGeo(latlngs);
    onPolygonCreated([geoCoords]);
    // Remove the drawn layer – we'll render it from state
    layer.remove();
  };

  const orgsWithCoords = organizations.filter(
    (org) => org.latitude != null && org.longitude != null
  );

  return (
    <MapContainer
      center={[59.9139, 10.7522]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

      {/* Drawing controls */}
      <FeatureGroup>
        <EditControl
          position="topright"
          draw={{
            polygon: {
              shapeOptions: { color: '#3B82F6', weight: 2, fillOpacity: 0.15 },
            },
            polyline: false,
            circle: false,
            rectangle: false,
            marker: false,
            circlemarker: false,
          }}
          edit={{ edit: false, remove: false }}
          onCreated={handleCreated}
        />
      </FeatureGroup>

      {/* Existing territories as colored polygons */}
      {territories.map((t) => {
        const positions = geoToLeaflet(t.polygon.coordinates[0]);
        const isSelected = t.id === selectedTerritoryId;
        return (
          <Polygon
            key={t.id}
            positions={positions}
            pathOptions={{
              color: t.color,
              fillColor: t.color,
              fillOpacity: isSelected ? 0.4 : 0.2,
              weight: isSelected ? 3 : 2,
            }}
            eventHandlers={{ click: () => onSelectTerritory(t.id) }}
          >
            <Tooltip sticky>{t.name}</Tooltip>
          </Polygon>
        );
      })}

      {/* Organization pins as small dots */}
      {orgsWithCoords.map((org) => (
        <CircleMarker
          key={org.id}
          center={[org.latitude!, org.longitude!]}
          radius={4}
          pathOptions={{
            color: '#374151',
            fillColor: org.assignedToId ? '#3B82F6' : '#9CA3AF',
            fillOpacity: 0.8,
            weight: 1,
          }}
        >
          <Tooltip>{org.name}<br />{org.address}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
