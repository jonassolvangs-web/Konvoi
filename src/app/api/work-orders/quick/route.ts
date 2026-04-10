import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { defaultChecklist } from '@/lib/constants';

const quickCreateSchema = z.object({
  customerName: z.string().min(1),
  address: z.string().min(1),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  scheduledAt: z.string(),
  orderType: z.string().default('ventilasjonsrens'),
  product: z.string().optional(),
  price: z.number().optional(),
  technicianId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const userName = (session.user as any).name || 'Ukjent';

    const body = await req.json();
    const parsed = quickCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const techId = data.technicianId || userId;

    const workOrder = await prisma.$transaction(async (tx) => {
      // Create organization
      const org = await tx.organization.create({
        data: {
          name: data.customerName,
          address: data.address,
          postalCode: data.postalCode || null,
          city: data.city || null,
          numUnits: 1,
          status: 'venter_tekniker',
        },
      });

      // Create dwelling unit
      const unit = await tx.dwellingUnit.create({
        data: {
          organizationId: org.id,
          unitNumber: '1',
          residentName: data.customerName,
          residentPhone: data.phone || null,
          residentEmail: data.email || null,
          visitStatus: 'besok_booket',
          orderType: data.orderType,
          product: data.product || null,
          price: data.price || 0,
          scheduledAt: new Date(data.scheduledAt),
          technicianId: techId,
        },
      });

      // Create work order
      const wo = await tx.workOrder.create({
        data: {
          organizationId: org.id,
          technicianId: techId,
          scheduledAt: new Date(data.scheduledAt),
        },
      });

      // Create work order unit
      await tx.workOrderUnit.create({
        data: {
          workOrderId: wo.id,
          dwellingUnitId: unit.id,
          orderType: data.orderType,
          productName: data.product || null,
          price: data.price || 0,
          checklist: JSON.stringify(defaultChecklist),
        },
      });

      // Chat message
      const dateStr = new Date(data.scheduledAt).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'long' });
      await tx.chatMessage.create({
        data: {
          channelType: 'organization',
          channelId: org.id,
          senderId: techId,
          organizationId: org.id,
          content: `${userName} opprettet oppdrag for ${data.customerName} – ${dateStr}`,
          isSystem: true,
        },
      });

      return wo;
    });

    return NextResponse.json({ workOrder }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Quick create work order error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
