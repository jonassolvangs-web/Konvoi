import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { geocodeAddress } from '@/lib/geonorge';
import { getOfficeCoordinates, calculateDistanceFromOffice } from '@/lib/distance';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });

    const result = await geocodeAddress(org.address, org.postalCode || undefined, org.city || undefined);
    if (!result) {
      return NextResponse.json({ error: 'Kunne ikke geokode adressen' }, { status: 422 });
    }

    const office = await getOfficeCoordinates();
    const distance = calculateDistanceFromOffice(office.lat, office.lon, result.lat, result.lon);

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        latitude: result.lat,
        longitude: result.lon,
        distanceFromOfficeKm: distance.distanceFromOfficeKm,
        distanceFromOfficeMin: distance.distanceFromOfficeMin,
      },
    });

    return NextResponse.json({ organization: updated });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Geocode org error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
