import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        organization: true,
        appointment: true,
        user: { select: { name: true } },
        dwellingUnits: {
          orderBy: [{ floor: 'asc' }, { unitNumber: 'asc' }],
          include: {
            workOrderUnits: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!visit) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
    return NextResponse.json({ visit });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const userId = (session.user as any).id;
    const userName = (session.user as any).name || 'Ukjent';

    const visit = await prisma.$transaction(async (tx) => {
      const v = await tx.visit.update({
        where: { id },
        data: {
          ...body,
          ...(body.status === 'pagaar' ? { startedAt: new Date() } : {}),
          ...(body.status === 'fullfort' ? { completedAt: new Date() } : {}),
        },
        include: { organization: { select: { id: true, name: true } } },
      });

      // Side effects based on status changes
      if (body.status === 'pagaar') {
        await tx.organization.update({
          where: { id: v.organizationId },
          data: { status: 'besok_pagaar' },
        });
        await tx.chatMessage.create({
          data: {
            channelType: 'organization',
            channelId: v.organizationId,
            senderId: userId,
            organizationId: v.organizationId,
            content: `${userName} startet besøk`,
            isSystem: true,
          },
        });
      }

      if (body.status === 'fullfort') {
        // Recalculate metrics
        const soldCount = await tx.dwellingUnit.count({
          where: { visitId: id, visitStatus: 'solgt' },
        });
        const totalRevenue = await tx.dwellingUnit.aggregate({
          where: { visitId: id, visitStatus: 'solgt' },
          _sum: { price: true },
        });
        await tx.visit.update({
          where: { id },
          data: {
            unitsSold: soldCount,
            totalRevenue: totalRevenue._sum.price || 0,
          },
        });

        const allUnits = await tx.dwellingUnit.count({ where: { visitId: id } });
        const visitedUnits = await tx.dwellingUnit.count({
          where: { visitId: id, visitStatus: { not: 'ikke_besokt' } },
        });

        await tx.chatMessage.create({
          data: {
            channelType: 'organization',
            channelId: v.organizationId,
            senderId: userId,
            organizationId: v.organizationId,
            content: `${userName} fullførte besøk – ${soldCount} enheter solgt av ${visitedUnits} besøkte (${allUnits} totalt)`,
            isSystem: true,
          },
        });
      }

      return v;
    });

    return NextResponse.json({ visit });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Update visit error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
