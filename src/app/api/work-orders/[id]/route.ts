import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        organization: true,
        technician: { select: { name: true, email: true } },
        units: {
          include: {
            dwellingUnit: true,
            product: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!workOrder) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
    return NextResponse.json({ workOrder });
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
    const userName = (session.user as any).name || 'Ukjent';

    // Handle unit updates (checklist, air measurements, payment, order changes)
    if (body.unitId) {
      const { unitId, ...unitData } = body;
      const unit = await prisma.workOrderUnit.update({
        where: { id: unitId },
        data: unitData,
      });
      return NextResponse.json({ unit });
    }

    // Handle work order start
    if (body.status === 'pagaar') {
      const workOrder = await prisma.$transaction(async (tx) => {
        const wo = await tx.workOrder.update({
          where: { id },
          data: { status: 'pagaar', startedAt: new Date() },
        });

        await tx.organization.update({
          where: { id: wo.organizationId },
          data: { status: 'rens_pagaar' },
        });

        await tx.chatMessage.create({
          data: {
            channelType: 'organization',
            channelId: wo.organizationId,
            senderId: wo.technicianId,
            organizationId: wo.organizationId,
            content: `${userName} startet oppdrag`,
            isSystem: true,
          },
        });

        return wo;
      });

      return NextResponse.json({ workOrder });
    }

    // Handle work order completion
    if (body.status === 'fullfort') {
      const workOrder = await prisma.$transaction(async (tx) => {
        const wo = await tx.workOrder.update({
          where: { id },
          data: {
            status: 'fullfort',
            completedAt: new Date(),
            signatureUrl: body.signatureUrl || null,
          },
          include: {
            units: { include: { dwellingUnit: true } },
          },
        });

        // Update org status
        await tx.organization.update({
          where: { id: wo.organizationId },
          data: { status: 'fullfort' },
        });

        // Create cleaning history
        const totalRevenue = wo.units.reduce((sum, u) => sum + u.price, 0);
        const airImprovements = wo.units
          .filter((u) => u.airBefore && u.airAfter)
          .map((u) => ((u.airAfter! - u.airBefore!) / u.airBefore!) * 100);
        const avgImprovement = airImprovements.length > 0
          ? airImprovements.reduce((a, b) => a + b, 0) / airImprovements.length
          : null;

        const nextCleaningDate = new Date();
        nextCleaningDate.setFullYear(nextCleaningDate.getFullYear() + 3);

        await tx.cleaningHistory.create({
          data: {
            organizationId: wo.organizationId,
            completedDate: new Date(),
            nextCleaningDate,
            reminderStatus: 'ok',
            numUnitsCompleted: wo.units.length,
            totalRevenue,
            avgAirImprovement: avgImprovement,
          },
        });

        // System chat message
        await tx.chatMessage.create({
          data: {
            channelType: 'organization',
            channelId: wo.organizationId,
            senderId: wo.technicianId,
            organizationId: wo.organizationId,
            content: `${userName} fullførte oppdraget – ${wo.units.length} enheter renset`,
            isSystem: true,
          },
        });

        // Notify all involved users
        const visits = await tx.visit.findMany({
          where: { organizationId: wo.organizationId },
          select: { userId: true },
        });
        const org = await tx.organization.findUnique({
          where: { id: wo.organizationId },
          select: { assignedToId: true, name: true },
        });

        const notifyUserIds = new Set<string>();
        visits.forEach((v) => notifyUserIds.add(v.userId));
        if (org?.assignedToId) notifyUserIds.add(org.assignedToId);

        for (const uid of notifyUserIds) {
          await tx.notification.create({
            data: {
              userId: uid,
              title: 'Oppdrag fullført',
              message: `${userName} fullførte oppdraget for ${org?.name}`,
              type: 'success',
            },
          });
        }

        return wo;
      });

      return NextResponse.json({ workOrder });
    }

    // General update (for simple field changes)
    const workOrder = await prisma.workOrder.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ workOrder });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Update work order error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
