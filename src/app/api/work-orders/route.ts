import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { defaultChecklist } from '@/lib/constants';
import { generateOrderConfirmationHtml } from '@/lib/order-confirmation-email';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'hei@godtvedlikehold.no';
const NOTIFY_EMAIL = 'hei@godtvedlikehold.no';

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

    const all = searchParams.get('all') === 'true';
    const where: any = all ? {} : { technicianId };
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
        techVisits: {
          select: {
            id: true, unitNumber: true, ownerName: true, ownerBirthDate: true,
            ownerPhone: true, ownerEmail: true, residentName: true, notes: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Auto-complete work orders where all units have reports sent
    const toComplete = workOrders.filter(
      (wo) => wo.status !== 'fullfort' && wo.units.length > 0 && wo.units.every((u) => u.reportSentAt)
    );
    for (const wo of toComplete) {
      await prisma.$transaction(async (tx) => {
        await tx.workOrder.update({
          where: { id: wo.id },
          data: { status: 'fullfort', completedAt: new Date() },
        });
        await tx.organization.update({
          where: { id: wo.organizationId },
          data: { status: 'fullfort' },
        });
        const totalRevenue = wo.units.reduce((sum, u) => sum + u.price, 0);
        const airImprovements = wo.units
          .filter((u) => u.airBefore && u.airAfter)
          .map((u) => ((u.airAfter! - u.airBefore!) / u.airBefore!) * 100);
        const avgImprovement = airImprovements.length > 0
          ? airImprovements.reduce((a, b) => a + b, 0) / airImprovements.length
          : null;
        const nextCleaningDate = new Date();
        nextCleaningDate.setFullYear(nextCleaningDate.getFullYear() + 3);
        await tx.cleaningHistory.create({
          data: {
            organizationId: wo.organizationId,
            completedDate: new Date(),
            nextCleaningDate,
            reminderStatus: 'ok',
            numUnitsCompleted: wo.units.length,
            totalRevenue,
            avgAirImprovement: avgImprovement,
          },
        });
      });
      wo.status = 'fullfort';
      wo.completedAt = new Date();
    }

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
      const dateStr = schedDate.toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'long' });

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

    // Send order confirmation emails (non-blocking)
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { address: true, postalCode: true, city: true },
      });

      const unitsWithCustomer = await prisma.dwellingUnit.findMany({
        where: { id: { in: units.map((u: any) => u.id) } },
        select: { residentName: true, residentEmail: true, product: true, price: true },
      });

      for (const unit of unitsWithCustomer) {
        const confirmationHtml = generateOrderConfirmationHtml({
          customerName: unit.residentName || org?.address || 'Kunde',
          address: org?.address || '',
          postalCode: org?.postalCode || undefined,
          city: org?.city || undefined,
          product: unit.product || 'Ventilasjonsrens',
          price: unit.price || 0,
          scheduledAt,
          customerEmail: unit.residentEmail || undefined,
        });

        const recipients = [NOTIFY_EMAIL, unit.residentEmail].filter(Boolean) as string[];

        resend.emails.send({
          from: `Godt Vedlikehold <${fromEmail}>`,
          to: recipients,
          subject: `Bestillingsbekreftelse – ${unit.residentName || org?.address || 'Ny bestilling'}`,
          html: confirmationHtml,
        }).then(({ error }) => {
          if (error) console.error('Resend email error:', JSON.stringify(error));
        }).catch((err) => {
          console.error('Email notification exception:', err);
        });
      }
    } catch (emailErr) {
      console.error('Order confirmation email exception:', emailErr);
    }

    return NextResponse.json({ workOrder }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create work order error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
