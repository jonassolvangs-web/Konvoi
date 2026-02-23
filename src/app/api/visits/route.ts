import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const createVisitSchema = z.object({
  organizationId: z.string(),
  appointmentId: z.string().optional(),
  source: z.enum(['booking', 'dor_til_dor']).default('booking'),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const where: any = { userId };
    if (status) where.status = status;

    const visits = await prisma.visit.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true, name: true, address: true, numUnits: true,
            distanceFromOfficeKm: true, distanceFromOfficeMin: true,
            latitude: true, longitude: true,
          },
        },
        appointment: { select: { scheduledAt: true, endAt: true } },
        _count: { select: { dwellingUnits: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ visits });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;

    const body = await req.json();
    const parsed = createVisitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });
    }

    const visit = await prisma.$transaction(async (tx) => {
      const v = await tx.visit.create({
        data: {
          organizationId: parsed.data.organizationId,
          appointmentId: parsed.data.appointmentId || null,
          userId,
          source: parsed.data.source,
          status: 'planlagt',
        },
      });

      await tx.organization.update({
        where: { id: parsed.data.organizationId },
        data: { status: 'besok_pagaar' },
      });

      return v;
    });

    return NextResponse.json({ visit }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create visit error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
