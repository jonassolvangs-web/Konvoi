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

    // Double-booking check: ensure no existing work order at this exact slot (30 min)
    const scheduledDate = new Date(scheduledAt);
    const slotEnd = new Date(scheduledDate.getTime() + 30 * 60 * 1000);

    const conflicting = await prisma.workOrder.findFirst({
      where: {
        technicianId: userId,
        status: { not: 'fullfort' },
        scheduledAt: {
          gte: scheduledDate,
          lt: slotEnd,
        },
      },
    });

    if (conflicting) {
      return NextResponse.json({ error: 'Tidspunktet er allerede booket. Velg et annet tidspunkt.' }, { status: 409 });
    }

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

      // Create dwelling unit — use owner as primary name, fallback to resident
      const dwellingUnit = await tx.dwellingUnit.create({
        data: {
          organizationId: org.id,
          unitNumber: visit.unitNumber,
          residentName: visit.ownerName || visit.residentName,
          residentPhone: visit.ownerPhone,
          residentEmail: visit.ownerEmail,
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

    // Send order confirmation email (non-blocking)
    try {
      const confirmationHtml = generateOrderConfirmationHtml({
        customerName: visit.ownerName || visit.residentName || visit.address,
        address: visit.address,
        postalCode: visit.postalCode || undefined,
        city: visit.city || undefined,
        product: product || orderType || 'Ventilasjonsrens',
        price,
        scheduledAt,
        customerEmail: visit.ownerEmail || undefined,
      });

      const recipients = [NOTIFY_EMAIL, visit.ownerEmail].filter(Boolean) as string[];

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: `Godt Vedlikehold <${fromEmail}>`,
        to: recipients,
        subject: `Bestillingsbekreftelse – ${visit.ownerName || visit.address}`,
        html: confirmationHtml,
      });
      if (emailError) {
        console.error('Resend email error:', JSON.stringify(emailError));
      } else {
        console.log('Order confirmation email sent:', emailData?.id);
      }
    } catch (emailErr) {
      console.error('Email notification exception:', emailErr);
    }

    return NextResponse.json({ workOrder: result }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create order from visit error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
