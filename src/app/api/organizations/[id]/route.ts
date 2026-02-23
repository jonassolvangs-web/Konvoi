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
