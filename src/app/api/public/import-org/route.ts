import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const IMPORT_KEY = 'turbo-import-2026';

export async function POST(req: NextRequest) {
  const data = await req.json();

  if (data.key !== IMPORT_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, address, postalCode, city, numUnits, chairmanName, chairmanBirthNumber, assignToUserId, notes } = data;

  if (!name || !address) {
    return NextResponse.json({ error: 'name and address required' }, { status: 400 });
  }

  // Geocode via geonorge
  let latitude: number | null = null;
  let longitude: number | null = null;
  try {
    const geoRes = await fetch(`https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(address)}&fuzzy=true&treffPerSide=1`);
    const geoData = await geoRes.json();
    const hit = geoData?.adresser?.[0]?.representasjonspunkt;
    if (hit) {
      latitude = hit.lat;
      longitude = hit.lon;
    }
  } catch {}

  // Calculate distance from office if we have coordinates
  let distanceFromOfficeKm: number | null = null;
  let distanceFromOfficeMin: number | null = null;
  if (latitude && longitude) {
    const officeLat = 59.9139;
    const officeLon = 10.7522;
    const R = 6371;
    const dLat = (latitude - officeLat) * Math.PI / 180;
    const dLon = (longitude - officeLon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(officeLat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    distanceFromOfficeKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    distanceFromOfficeMin = Math.round(distanceFromOfficeKm * 2);
  }

  const org = await prisma.organization.create({
    data: {
      name,
      address,
      postalCode: postalCode || null,
      city: city || null,
      numUnits: numUnits || 1,
      chairmanName: chairmanName || null,
      chairmanBirthNumber: chairmanBirthNumber || null,
      latitude,
      longitude,
      distanceFromOfficeKm,
      distanceFromOfficeMin,
      status: assignToUserId ? 'tildelt' : 'ikke_tildelt',
      assignedToId: assignToUserId || null,
      notes: notes || null,
    },
  });

  return NextResponse.json({ ok: true, id: org.id, geocoded: !!(latitude && longitude) });
}
