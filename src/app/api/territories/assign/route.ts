import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';

const assignSchema = z.union([
  z.object({ territoryId: z.string() }),
  z.object({ all: z.literal(true) }),
]);

export async function POST(req: NextRequest) {
  try {
    await requireRole('ADMIN');

    const body = await req.json();
    const parsed = assignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });
    }

    // Get territories to process
    let territories;
    if ('territoryId' in parsed.data) {
      territories = await prisma.territory.findMany({
        where: { id: parsed.data.territoryId, assignedToId: { not: null } },
      });
    } else {
      territories = await prisma.territory.findMany({
        where: { assignedToId: { not: null } },
      });
    }

    if (territories.length === 0) {
      return NextResponse.json({ error: 'Ingen revir med tildelt selger funnet' }, { status: 400 });
    }

    // Get all organizations with coordinates
    const organizations = await prisma.organization.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, latitude: true, longitude: true },
    });

    let totalAssigned = 0;

    for (const territory of territories) {
      const geoPolygon = territory.polygon as { type: string; coordinates: number[][][] };

      // Build Turf polygon – GeoJSON coordinates are already [lng, lat]
      const turfPolygon = polygon(geoPolygon.coordinates);

      const matchingOrgIds: string[] = [];

      for (const org of organizations) {
        // Create Turf point with [lng, lat] order
        const turfPoint = point([org.longitude!, org.latitude!]);

        if (booleanPointInPolygon(turfPoint, turfPolygon)) {
          matchingOrgIds.push(org.id);
        }
      }

      if (matchingOrgIds.length > 0) {
        await prisma.organization.updateMany({
          where: { id: { in: matchingOrgIds } },
          data: { assignedToId: territory.assignedToId },
        });
        totalAssigned += matchingOrgIds.length;
      }
    }

    return NextResponse.json({ count: totalAssigned });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Assign territory error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
