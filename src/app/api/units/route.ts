import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const createUnitSchema = z.object({
  organizationId: z.string(),
  visitId: z.string().optional(),
  unitNumber: z.string(),
  floor: z.number().optional(),
  residentName: z.string().optional(),
  residentPhone: z.string().optional(),
  residentEmail: z.string().optional(),
  visitStatus: z.enum(['ikke_besokt', 'solgt', 'ikke_interessert', 'ikke_hjemme']).optional(),
  orderType: z.enum(['ventilasjonsrens', 'service']).optional(),
  product: z.string().optional(),
  price: z.number().optional(),
  paymentPlanMonths: z.number().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

const bulkCreateSchema = z.object({
  organizationId: z.string(),
  visitId: z.string(),
  units: z.array(z.object({
    unitNumber: z.string(),
    floor: z.number().optional(),
  })),
});

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();

    // Check if bulk create
    if (body.units && Array.isArray(body.units)) {
      const parsed = bulkCreateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });
      }

      const created = await prisma.$transaction(
        parsed.data.units.map((unit) =>
          prisma.dwellingUnit.create({
            data: {
              organizationId: parsed.data.organizationId,
              visitId: parsed.data.visitId,
              unitNumber: unit.unitNumber,
              floor: unit.floor ?? null,
            },
          })
        )
      );

      return NextResponse.json({ units: created, count: created.length }, { status: 201 });
    }

    // Single create
    const parsed = createUnitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    const unit = await prisma.dwellingUnit.create({
      data: {
        organizationId: parsed.data.organizationId,
        visitId: parsed.data.visitId || null,
        unitNumber: parsed.data.unitNumber,
        floor: parsed.data.floor ?? null,
        residentName: parsed.data.residentName || null,
        residentPhone: parsed.data.residentPhone || null,
        residentEmail: parsed.data.residentEmail || null,
        visitStatus: parsed.data.visitStatus || 'ikke_besokt',
        orderType: parsed.data.orderType || null,
        product: parsed.data.product || null,
        price: parsed.data.price ?? null,
        paymentPlanMonths: parsed.data.paymentPlanMonths ?? null,
        paymentMethod: parsed.data.paymentMethod || null,
        notes: parsed.data.notes || null,
      },
    });

    return NextResponse.json({ unit }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create unit error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
