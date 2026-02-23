import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { defaultChecklist } from '@/lib/constants';

const createWorkOrderSchema = z.object({
  organizationId: z.string(),
  technicianId: z.string(),
  scheduledAt: z.string(),
  unitIds: z.array(z.string()),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const technicianId = searchParams.get('technicianId') || userId;
    const status = searchParams.get('status');

    const where: any = { technicianId };
    if (status) where.status = status;

    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true, name: true, address: true,
            distanceFromOfficeKm: true, distanceFromOfficeMin: true,
            latitude: true, longitude: true,
          },
        },
        technician: { select: { name: true } },
        units: {
          include: {
            dwellingUnit: true,
            product: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ workOrders });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userName = (session.user as any).name || 'Ukjent';

    const body = await req.json();
    const parsed = createWorkOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });
    }
    const { organizationId, technicianId, scheduledAt, unitIds } = parsed.data;

    // Get sold dwelling units
    const units = await prisma.dwellingUnit.findMany({
      where: { id: { in: unitIds }, visitStatus: 'solgt' },
    });

    if (units.length === 0) {
      return NextResponse.json({ error: 'Ingen solgte enheter funnet' }, { status: 400 });
    }

    const workOrder = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          organizationId,
          technicianId,
          scheduledAt: new Date(scheduledAt),
        },
      });

      // Create work order units - copy data from dwelling units
      for (const unit of units) {
        await tx.workOrderUnit.create({
          data: {
            workOrderId: wo.id,
            dwellingUnitId: unit.id,
            orderType: unit.orderType || 'ventilasjonsrens',
            productName: unit.product || null,
            price: unit.price || 3990,
            paymentMethod: unit.paymentMethod || null,
            paymentPlanMonths: unit.paymentPlanMonths || null,
            checklist: JSON.stringify(defaultChecklist),
          },
        });
      }

      // Update org status
      await tx.organization.update({
        where: { id: organizationId },
        data: { status: 'venter_tekniker' },
      });

      // Get technician name for chat message
      const tech = await tx.user.findUnique({ where: { id: technicianId }, select: { name: true } });
      const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { name: true } });

      const schedDate = new Date(scheduledAt);
      const dateStr = schedDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' });

      const totalPrice = units.reduce((sum, u) => sum + (u.price || 0), 0);

      // System chat message
      await tx.chatMessage.create({
        data: {
          channelType: 'organization',
          channelId: organizationId,
          senderId: technicianId || (session.user as any).id,
          organizationId,
          content: `${userName} fullførte besøk – ${units.length} enheter solgt. Tekniker ${tech?.name || 'ukjent'} booket til ${dateStr}`,
          isSystem: true,
        },
      });

      // Notify technician
      if (technicianId) {
        await tx.notification.create({
          data: {
            userId: technicianId,
            title: 'Nytt oppdrag tildelt',
            message: `Du har fått et nytt oppdrag for ${org?.name} – ${units.length} enheter, ${dateStr}`,
            type: 'info',
            linkUrl: '/tekniker/oppdrag',
          },
        });
      }

      return wo;
    });

    return NextResponse.json({ workOrder }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create work order error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
