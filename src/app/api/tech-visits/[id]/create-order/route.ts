import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { defaultChecklist } from '@/lib/constants';

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

    // Send email notification (non-blocking)
    const techUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const schedDate = new Date(scheduledAt);
    const dateStr = schedDate.toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = schedDate.toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' });

    try {
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: `Godt Vedlikehold <${fromEmail}>`,
        to: NOTIFY_EMAIL,
        subject: `Ny bestilling – ${visit.ownerName || visit.address}`,
        html: `
          <h2>Ny bestilling fra besøk</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;">
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Tekniker</td><td style="padding:4px 0;font-weight:600;">${techUser?.name || 'Ukjent'}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Eier</td><td style="padding:4px 0;font-weight:600;">${visit.ownerName || '–'}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Adresse</td><td style="padding:4px 0;font-weight:600;">${visit.address}${visit.postalCode ? `, ${visit.postalCode}` : ''}${visit.city ? ` ${visit.city}` : ''}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Leilighet</td><td style="padding:4px 0;font-weight:600;">${visit.unitNumber}</td></tr>
            ${visit.ownerPhone ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Telefon</td><td style="padding:4px 0;font-weight:600;">${visit.ownerPhone}</td></tr>` : ''}
            ${visit.ownerEmail ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">E-post</td><td style="padding:4px 0;font-weight:600;">${visit.ownerEmail}</td></tr>` : ''}
            ${visit.residentName ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Beboer</td><td style="padding:4px 0;font-weight:600;">${visit.residentName}</td></tr>` : ''}
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Dato</td><td style="padding:4px 0;font-weight:600;">${dateStr}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Tid</td><td style="padding:4px 0;font-weight:600;">${timeStr}</td></tr>
            ${visit.notes ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Notat</td><td style="padding:4px 0;">${visit.notes}</td></tr>` : ''}
          </table>
        `,
      });
      if (emailError) {
        console.error('Resend email error:', JSON.stringify(emailError));
      } else {
        console.log('Email notification sent:', emailData?.id);
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
