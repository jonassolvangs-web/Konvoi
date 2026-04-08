import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const { id } = await params;

    const visit = await prisma.techVisit.findFirst({
      where: { id, technicianId: userId },
      include: {
        workOrder: {
          select: { id: true, status: true, scheduledAt: true },
        },
      },
    });

    if (!visit) {
      return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
    }

    return NextResponse.json({ visit });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const { id } = await params;

    const existing = await prisma.techVisit.findFirst({
      where: { id, technicianId: userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
    }

    const body = await req.json();
    const { unitNumber, address, postalCode, city, ownerName, ownerBirthDate, ownerPhone, residentName, notes } = body;

    const visit = await prisma.techVisit.update({
      where: { id },
      data: {
        ...(unitNumber !== undefined && { unitNumber }),
        ...(address !== undefined && { address }),
        ...(postalCode !== undefined && { postalCode }),
        ...(city !== undefined && { city }),
        ...(ownerName !== undefined && { ownerName }),
        ...(ownerBirthDate !== undefined && { ownerBirthDate }),
        ...(ownerPhone !== undefined && { ownerPhone }),
        ...(residentName !== undefined && { residentName }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({ visit });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const { id } = await params;

    const existing = await prisma.techVisit.findFirst({
      where: { id, technicianId: userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
    }

    if (existing.workOrderId) {
      return NextResponse.json({ error: 'Kan ikke slette besøk med tilknyttet bestilling' }, { status: 400 });
    }

    await prisma.techVisit.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
