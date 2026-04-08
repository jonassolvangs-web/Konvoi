import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { defaultChecklist } from '@/lib/constants';

const createOrderSchema = z.object({
  scheduledAt: z.string(),
  orderType: z.string().default('ventilasjonsrens'),
  product: z.string().optional(),
  price: z.number().default(0),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const { id } = await params;

    const visit = await prisma.techVisit.findFirst({
      where: { id, technicianId: userId },
    });

    if (!visit) {
      return NextResponse.json({ error: 'Besøk ikke funnet' }, { status: 404 });
    }

    if (visit.workOrderId) {
      return NextResponse.json({ error: 'Bestilling allerede opprettet' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });
    }

    const { scheduledAt, orderType, product, price } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // Create or find organization from the visit address
      let org = await tx.organization.findFirst({
        where: { address: visit.address },
      });

      if (!org) {
        org = await tx.organization.create({
          data: {
            name: visit.address,
            address: visit.address,
            postalCode: visit.postalCode,
            city: visit.city,
            status: 'venter_tekniker',
          },
        });
      } else {
        await tx.organization.update({
          where: { id: org.id },
          data: { status: 'venter_tekniker' },
        });
      }

      // Create dwelling unit
      const dwellingUnit = await tx.dwellingUnit.create({
        data: {
          organizationId: org.id,
          unitNumber: visit.unitNumber,
          residentName: visit.residentName,
          residentPhone: visit.ownerPhone,
          visitStatus: 'solgt',
        },
      });

      // Create work order
      const workOrder = await tx.workOrder.create({
        data: {
          organizationId: org.id,
          technicianId: userId,
          scheduledAt: new Date(scheduledAt),
        },
      });

      // Create work order unit
      await tx.workOrderUnit.create({
        data: {
          workOrderId: workOrder.id,
          dwellingUnitId: dwellingUnit.id,
          orderType,
          productName: product || null,
          price,
          checklist: JSON.stringify(defaultChecklist),
        },
      });

      // Update tech visit
      await tx.techVisit.update({
        where: { id: visit.id },
        data: {
          workOrderId: workOrder.id,
          status: 'bestilt',
        },
      });

      return workOrder;
    });

    return NextResponse.json({ workOrder: result }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create order from visit error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
