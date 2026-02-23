import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { geocodeAddress } from '@/lib/geonorge';
import { getOfficeCoordinates, calculateDistanceFromOffice } from '@/lib/distance';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('ADMIN');

    const body = await req.json();
    const { organizations } = body;

    if (!Array.isArray(organizations) || organizations.length === 0) {
      return NextResponse.json({ error: 'Ingen data' }, { status: 400 });
    }

    const office = await getOfficeCoordinates();

    let created = 0;
    let skipped = 0;
    let geocoded = 0;

    for (const org of organizations) {
      if (!org.name || !org.address) {
        skipped++;
        continue;
      }

      try {
        const lat = org.latitude ? parseFloat(org.latitude) : null;
        const lon = org.longitude ? parseFloat(org.longitude) : null;

        const newOrg = await prisma.organization.create({
          data: {
            name: org.name,
            address: org.address,
            postalCode: org.postalCode || null,
            city: org.city || null,
            latitude: lat,
            longitude: lon,
            numUnits: org.numUnits ? parseInt(org.numUnits) : null,
            buildingYear: org.buildingYear ? parseInt(org.buildingYear) : null,
            managementCompany: org.managementCompany || null,
            chairmanName: org.chairmanName || null,
            chairmanPhone: org.chairmanPhone || null,
            chairmanEmail: org.chairmanEmail || null,
          },
        });
        created++;

        // Auto-geocode if coordinates missing
        if (newOrg.latitude == null || newOrg.longitude == null) {
          await delay(100);
          const result = await geocodeAddress(newOrg.address, newOrg.postalCode || undefined, newOrg.city || undefined);
          if (result) {
            const distance = calculateDistanceFromOffice(office.lat, office.lon, result.lat, result.lon);
            await prisma.organization.update({
              where: { id: newOrg.id },
              data: {
                latitude: result.lat,
                longitude: result.lon,
                distanceFromOfficeKm: distance.distanceFromOfficeKm,
                distanceFromOfficeMin: distance.distanceFromOfficeMin,
              },
            });
            geocoded++;
          }
        }
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({ success: true, created, skipped, geocoded });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
