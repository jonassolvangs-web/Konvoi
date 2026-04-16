import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { defaultChecklist } from '@/lib/constants';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'hei@godtvedlikehold.no';

const bookingSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  address: z.string().min(1),
  postalCode: z.string().optional(),
  floor: z.string().optional(),
  scheduledAt: z.string(), // ISO datetime e.g. "2026-04-22T14:00:00"
});

function generateConfirmationEmail(data: {
  name: string;
  address: string;
  postalCode?: string;
  floor?: string;
  date: string;
  time: string;
}) {
  const floorRow = data.floor
    ? `<tr style="border-top:1px solid rgba(26,26,46,0.06);"><td style="padding:8px 0;color:#6B6B7B;">Etasje</td><td style="padding:8px 0;font-weight:700;text-align:right;">${data.floor}</td></tr>`
    : '';
  const addressDisplay = data.postalCode ? `${data.address}, ${data.postalCode}` : data.address;

  return `
<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"></head>
<body style="font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:0;color:#1A1A2E;background:#FAF7F2;">
  <div style="padding:32px 24px 0;">
    <p style="font-size:17px;margin-bottom:4px;">Hei ${data.name},</p>
    <p style="font-size:15px;color:#2E2E48;line-height:1.6;margin-bottom:24px;">Takk for bestillingen! Her er en oppsummering av din booking:</p>

    <div style="background:#FFFFFF;border:1px solid rgba(26,26,46,0.08);border-radius:16px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;font-size:15px;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#6B6B7B;">Dato</td><td style="padding:8px 0;font-weight:700;text-align:right;">${data.date}</td></tr>
        <tr style="border-top:1px solid rgba(26,26,46,0.06);"><td style="padding:8px 0;color:#6B6B7B;">Tid</td><td style="padding:8px 0;font-weight:700;text-align:right;">${data.time}</td></tr>
        <tr style="border-top:1px solid rgba(26,26,46,0.06);"><td style="padding:8px 0;color:#6B6B7B;">Adresse</td><td style="padding:8px 0;font-weight:700;text-align:right;">${addressDisplay}</td></tr>
        ${floorRow}
        <tr style="border-top:1px solid rgba(26,26,46,0.06);"><td style="padding:8px 0;color:#6B6B7B;">Tjeneste</td><td style="padding:8px 0;font-weight:700;text-align:right;">Ventilasjonsrens</td></tr>
      </table>
    </div>

    <div style="background:#E8EFF8;border-radius:12px;padding:16px;font-size:14px;color:#1B3C73;line-height:1.6;margin-bottom:20px;">
      <strong>Hva skjer n&aring;?</strong><br>
      En av v&aring;re dyktige teknikere tar kontakt f&oslash;r avtalt tid! Jobben tar ca. 1 time. Takk for tilliten!
    </div>

    <div style="background:#FFFFFF;border:1px solid rgba(26,26,46,0.08);border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#1B3C73;margin:0 0 8px;">Din tekniker</p>
      <p style="font-size:15px;font-weight:700;margin:0 0 6px;">H&aring;vard Melby</p>
      <p style="font-size:14px;color:#6B6B7B;margin:0 0 2px;line-height:1.6;">Telefon: <a href="tel:+4793672506" style="color:#1B3C73;text-decoration:none;">936 72 506</a></p>
      <p style="font-size:14px;color:#6B6B7B;margin:0;line-height:1.6;">E-post: <a href="mailto:haavard@godtvedlikehold.no" style="color:#1B3C73;text-decoration:none;">haavard@godtvedlikehold.no</a></p>
    </div>

    <p style="font-size:13px;color:#6B6B7B;margin-bottom:0;">Med vennlig hilsen,<br><strong style="color:#1A1A2E;">Godt Vedlikehold</strong></p>
  </div>

  <div style="margin-top:32px;padding:20px 24px;border-top:1px solid rgba(26,26,46,0.06);text-align:center;">
    <p style="font-size:11px;color:#B5AFA5;line-height:1.6;margin:0;">Godt Vedlikehold &mdash; Bedre inneklima, renere luft<br>Org.nr: 933 662 818</p>
  </div>
</body>
</html>`;
}

/**
 * Public endpoint — no auth required.
 * Creates a booking (work order) and sends confirmation email.
 *
 * POST /api/public/booking/create
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Find technician
    const techEmail = process.env.BOOKING_TECHNICIAN_EMAIL;
    let tech;
    if (techEmail) {
      tech = await prisma.user.findFirst({
        where: { email: techEmail, isActive: true },
        select: { id: true, name: true },
      });
    }
    if (!tech) {
      tech = await prisma.user.findFirst({
        where: { isActive: true, roles: { contains: 'TEKNIKER' } },
        select: { id: true, name: true },
      });
    }
    if (!tech) {
      return NextResponse.json({ error: 'Ingen tekniker tilgjengelig' }, { status: 500 });
    }

    // Create organization + unit + work order in transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.name,
          address: data.address,
          postalCode: data.postalCode || null,
          city: null,
          numUnits: 1,
          status: 'venter_tekniker',
        },
      });

      const unit = await tx.dwellingUnit.create({
        data: {
          organizationId: org.id,
          unitNumber: '1',
          floor: data.floor ? parseInt(data.floor) || null : null,
          residentName: data.name,
          residentPhone: data.phone,
          residentEmail: data.email || null,
          visitStatus: 'besok_booket',
          orderType: 'ventilasjonsrens',
          price: 4990,
          scheduledAt: new Date(data.scheduledAt),
          technicianId: tech!.id,
        },
      });

      const wo = await tx.workOrder.create({
        data: {
          organizationId: org.id,
          technicianId: tech!.id,
          scheduledAt: new Date(data.scheduledAt),
          notes: `Selvbooking via nettside. Etasje: ${data.floor || 'Ikke oppgitt'}. Tlf: ${data.phone}`,
        },
      });

      await tx.workOrderUnit.create({
        data: {
          workOrderId: wo.id,
          dwellingUnitId: unit.id,
          orderType: 'ventilasjonsrens',
          productName: 'Ventilasjonsrens',
          price: 4990,
          checklist: JSON.stringify(defaultChecklist),
        },
      });

      // System chat message
      const dateObj = new Date(data.scheduledAt);
      const dateStr = dateObj.toLocaleDateString('nb-NO', {
        timeZone: 'Europe/Oslo', weekday: 'long', day: 'numeric', month: 'long',
      });
      const timeStr = dateObj.toLocaleTimeString('nb-NO', {
        timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit',
      });

      await tx.chatMessage.create({
        data: {
          channelType: 'organization',
          channelId: org.id,
          senderId: tech!.id,
          organizationId: org.id,
          content: `Ny selvbooking: ${data.name} – ${dateStr} kl. ${timeStr} (${data.address})`,
          isSystem: true,
        },
      });

      return { workOrderId: wo.id, dateStr, timeStr };
    });

    // Send confirmation emails (must await before response or Vercel kills the function)
    const html = generateConfirmationEmail({
      name: data.name,
      address: data.address,
      postalCode: data.postalCode || undefined,
      floor: data.floor || undefined,
      date: result.dateStr,
      time: result.timeStr,
    });

    const emailPromises: Promise<any>[] = [];

    // To customer
    if (data.email) {
      emailPromises.push(
        resend.emails.send({
          from: `Godt Vedlikehold <${fromEmail}>`,
          to: data.email,
          subject: 'Bekreftelse – Ventilasjonsrens',
          html,
        }).catch((err) => {
          console.error('Failed to send confirmation email to customer:', err);
        })
      );
    }

    // To Godt Vedlikehold
    emailPromises.push(
      resend.emails.send({
        from: `Godt Vedlikehold <${fromEmail}>`,
        to: 'hei@godtvedlikehold.no',
        subject: `Ny booking – ${data.name} – ${result.dateStr} kl. ${result.timeStr}`,
        html,
      }).catch((err) => {
        console.error('Failed to send notification email to admin:', err);
      })
    );

    await Promise.all(emailPromises);

    return NextResponse.json({
      success: true,
      workOrderId: result.workOrderId,
      date: result.dateStr,
      time: result.timeStr,
    }, { status: 201 });
  } catch (error) {
    console.error('Public booking create error:', error);
    return NextResponse.json({ error: 'Kunne ikke opprette booking' }, { status: 500 });
  }
}
