import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { geocodeAddress } from '@/lib/geonorge';
import { getOfficeCoordinates, calculateDistanceFromOffice } from '@/lib/distance';
import { sendPushToAll } from '@/lib/push';

const createOrgSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  numUnits: z.number().optional(),
  buildingYear: z.number().optional(),
  managementCompany: z.string().optional(),
  chairmanName: z.string().optional(),
  chairmanPhone: z.string().optional(),
  chairmanEmail: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const assignedTo = searchParams.get('assignedTo') || '';
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (assignedTo) where.assignedToId = assignedTo;

    const organizations = await prisma.organization.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: {
          select: {
            appointments: true,
            visits: true,
            workOrders: true,
            dwellingUnits: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return NextResponse.json({ organizations });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const parsed = createOrgSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    let org = await prisma.organization.create({ data: parsed.data });

    // Auto-geocode if coordinates missing
    if (org.latitude == null || org.longitude == null) {
      const result = await geocodeAddress(org.address, org.postalCode || undefined, org.city || undefined);
      if (result) {
        const office = await getOfficeCoordinates();
        const distance = calculateDistanceFromOffice(office.lat, office.lon, result.lat, result.lon);
        org = await prisma.organization.update({
          where: { id: org.id },
          data: {
            latitude: result.lat,
            longitude: result.lon,
            distanceFromOfficeKm: distance.distanceFromOfficeKm,
            distanceFromOfficeMin: distance.distanceFromOfficeMin,
          },
        });
      }
    }

    // Send push notification to all subscribers
    sendPushToAll({
      title: 'Ny adresse lagt til',
      body: `${org.name} – ${org.city || org.address}`,
      url: '/motebooker/kart',
    }).catch((err) => console.error('Push send error:', err));

    return NextResponse.json({ organization: org }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create org error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
