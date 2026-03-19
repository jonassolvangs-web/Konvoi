import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true } },
        appointments: {
          include: { user: { select: { name: true } } },
          orderBy: { scheduledAt: 'desc' },
          take: 5,
        },
        visits: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        workOrders: {
          include: { technician: { select: { name: true } } },
          orderBy: { scheduledAt: 'desc' },
          take: 5,
        },
        dwellingUnits: { orderBy: { unitNumber: 'asc' } },
        callRecords: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        cleaningHistories: { orderBy: { completedDate: 'desc' }, take: 5 },
      },
    });

    if (!org) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
    return NextResponse.json({ organization: org });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      // Delete chat messages
      await tx.chatMessage.deleteMany({ where: { organizationId: id } });
      // Delete call records
      await tx.callRecord.deleteMany({ where: { organizationId: id } });
      // Delete filter subscriptions
      await tx.filterSubscription.deleteMany({ where: { organizationId: id } });
      // Delete cleaning history
      await tx.cleaningHistory.deleteMany({ where: { organizationId: id } });
      // Delete work order units via work orders
      const workOrders = await tx.workOrder.findMany({ where: { organizationId: id }, select: { id: true } });
      if (workOrders.length > 0) {
        await tx.workOrderUnit.deleteMany({ where: { workOrderId: { in: workOrders.map((wo) => wo.id) } } });
      }
      await tx.workOrder.deleteMany({ where: { organizationId: id } });
      // Delete dwelling units
      await tx.dwellingUnit.deleteMany({ where: { organizationId: id } });
      // Delete visits
      await tx.visit.deleteMany({ where: { organizationId: id } });
      // Delete appointments
      await tx.appointment.deleteMany({ where: { organizationId: id } });
      // Delete organization
      await tx.organization.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Delete org error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const body = await req.json();
    const org = await prisma.organization.update({ where: { id }, data: body });
    return NextResponse.json({ organization: org });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Update org error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
