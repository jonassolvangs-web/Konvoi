import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const createSubscriptionSchema = z.object({
  dwellingUnitId: z.string(),
  organizationId: z.string(),
  months: z.number().min(1),
  pricePerMonth: z.number().min(0),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    const where: any = {};
    if (organizationId) where.organizationId = organizationId;

    const subscriptions = await prisma.filterSubscription.findMany({
      where,
      include: {
        dwellingUnit: { select: { unitNumber: true, residentName: true } },
        organization: { select: { name: true, address: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ subscriptions });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const parsed = createSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });
    }

    const { dwellingUnitId, organizationId, months, pricePerMonth } = parsed.data;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    const subscription = await prisma.filterSubscription.create({
      data: {
        dwellingUnitId,
        organizationId,
        months,
        pricePerMonth,
        startDate,
        endDate,
      },
    });

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create filter subscription error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
