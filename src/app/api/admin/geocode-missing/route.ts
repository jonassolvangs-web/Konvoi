import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { geocodeAddress } from '@/lib/geonorge';
import { getOfficeCoordinates, calculateDistanceFromOffice } from '@/lib/distance';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST() {
  try {
    await requireRole('ADMIN');

    const orgs = await prisma.organization.findMany({
      where: {
        OR: [{ latitude: null }, { longitude: null }],
      },
    });

    const office = await getOfficeCoordinates();
    let geocoded = 0;
    let failed = 0;

    for (const org of orgs) {
      await delay(100);
      const result = await geocodeAddress(org.address, org.postalCode || undefined, org.city || undefined);
      if (result) {
        const distance = calculateDistanceFromOffice(office.lat, office.lon, result.lat, result.lon);
        await prisma.organization.update({
          where: { id: org.id },
          data: {
            latitude: result.lat,
            longitude: result.lon,
            distanceFromOfficeKm: distance.distanceFromOfficeKm,
            distanceFromOfficeMin: distance.distanceFromOfficeMin,
          },
        });
        geocoded++;
      } else {
        failed++;
      }
    }

    return NextResponse.json({ total: orgs.length, geocoded, failed });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Geocode missing error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
