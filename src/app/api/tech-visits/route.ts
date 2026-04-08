import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const createVisitSchema = z.object({
  unitNumber: z.string().min(1),
  address: z.string().min(1),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  ownerName: z.string().optional(),
  ownerBirthDate: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerEmail: z.string().optional(),
  residentName: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;

    const visits = await prisma.techVisit.findMany({
      where: { technicianId: userId },
      include: {
        workOrder: {
          select: { id: true, status: true, scheduledAt: true },
        },
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

    const visit = await prisma.techVisit.create({
      data: {
        technicianId: userId,
        ...parsed.data,
      },
    });

    return NextResponse.json({ visit }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create tech visit error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
