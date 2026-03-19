import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { defaultChecklist } from '@/lib/constants';

const createWorkOrderSchema = z.object({
  organizationId: z.string(),
  technicianId: z.string(),
  scheduledAt: z.string(),
  unitIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
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
    const { organizationId, technicianId, scheduledAt, unitIds, notes } = parsed.data;

    const hasUnitIds = unitIds && unitIds.length > 0;

    // Get dwelling units (sold or booked) — only if unitIds provided
    let units: any[] = [];
    if (hasUnitIds) {
      units = await prisma.dwellingUnit.findMany({
        where: { id: { in: unitIds }, visitStatus: { in: ['solgt', 'besok_booket'] } },
      });

      if (units.length === 0) {
        return NextResponse.json({ error: 'Ingen registrerte enheter funnet' }, { status: 400 });
      }
    }

    const workOrder = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          organizationId,
          technicianId,
          scheduledAt: new Date(scheduledAt),
          notes: notes || null,
        },
      });

      if (hasUnitIds) {
        // Create work order units from existing dwelling units
        for (const unit of units) {
          await tx.workOrderUnit.create({
            data: {
              workOrderId: wo.id,
              dwellingUnitId: unit.id,
              orderType: unit.orderType || 'ventilasjonsrens',
              productName: unit.product || null,
              price: unit.price || 0,
              paymentMethod: unit.paymentMethod || null,
              paymentPlanMonths: unit.paymentPlanMonths || null,
              checklist: JSON.stringify(defaultChecklist),
            },
          });
        }
      } else {
        // No unitIds provided (e.g. created from møtebooker map) — auto-create dwelling units
        const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { numUnits: true } });
        const count = org?.numUnits || 1;

        // Check if org already has dwelling units we can reuse
        const existingUnits = await tx.dwellingUnit.findMany({
          where: { organizationId },
          orderBy: { unitNumber: 'asc' },
        });

        const dwellingUnits = existingUnits.length > 0
          ? existingUnits
          : await Promise.all(
              Array.from({ length: count }, (_, i) =>
                tx.dwellingUnit.create({
                  data: {
                    organizationId,
                    unitNumber: String(i + 1),
                    visitStatus: 'ikke_besokt',
                  },
                })
              )
            );

        for (const du of dwellingUnits) {
          await tx.workOrderUnit.create({
            data: {
              workOrderId: wo.id,
              dwellingUnitId: du.id,
              orderType: 'ventilasjonsrens',
              price: 0,
              checklist: JSON.stringify(defaultChecklist),
            },
          });
        }
        units = dwellingUnits;
      }

      // Update org status
      await tx.organization.update({
        where: { id: organizationId },
        data: { status: 'venter_tekniker' },
      });

      // Get technician name for chat message
      const tech = await tx.user.findUnique({ where: { id: technicianId }, select: { name: true } });
      const orgInfo = await tx.organization.findUnique({ where: { id: organizationId }, select: { name: true } });

      const schedDate = new Date(scheduledAt);
      const dateStr = schedDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' });

      // System chat message
      const chatContent = `${userName} opprettet oppdrag – ${units.length} enheter. Tekniker ${tech?.name || 'ukjent'} booket til ${dateStr}`;

      await tx.chatMessage.create({
        data: {
          channelType: 'organization',
          channelId: organizationId,
          senderId: (session.user as any).id,
          organizationId,
          content: chatContent,
          isSystem: true,
        },
      });

      // Notify technician
      if (technicianId) {
        await tx.notification.create({
          data: {
            userId: technicianId,
            title: 'Nytt oppdrag tildelt',
            message: `Du har fått et nytt oppdrag for ${orgInfo?.name} – ${units.length} enheter, ${dateStr}`,
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
