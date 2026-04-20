import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'hei@godtvedlikehold.no';

/**
 * GET /api/public/facebook-leads
 * Facebook webhook verification (hub.verify_token challenge).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST /api/public/facebook-leads
 * Receives lead webhook from Facebook, fetches full lead data from Graph API,
 * creates a TechVisit, and sends notification emails.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify HMAC-SHA256 signature
    const signature = req.headers.get('x-hub-signature-256');
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (appSecret && signature) {
      const expected =
        'sha256=' +
        crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (signature !== expected) {
        console.error('Facebook webhook signature mismatch');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    const payload = JSON.parse(rawBody);
    const leadgenId = payload?.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
    if (!leadgenId) {
      // Facebook sometimes sends test pings without lead data
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Fetch full lead data from Facebook Graph API
    const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    if (!pageToken) {
      console.error('FACEBOOK_PAGE_ACCESS_TOKEN not configured');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const graphRes = await fetch(
      `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${pageToken}`
    );
    if (!graphRes.ok) {
      const errText = await graphRes.text();
      console.error('Facebook Graph API error:', graphRes.status, errText);
      return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 502 });
    }

    const leadData = await graphRes.json();

    // Map Facebook form fields to our data model
    const fields: Record<string, string> = {};
    for (const f of leadData.field_data ?? []) {
      fields[f.name] = f.values?.[0] ?? '';
    }

    const ownerName = fields['full_name'] || '';
    const ownerPhone = fields['phone_number'] || '';
    const ownerEmail = fields['email'] || '';
    const address = fields['street_address'] || '';
    const postalCode = fields['zip'] || '';

    // Find technician (same pattern as booking/create)
    const techEmail = process.env.BOOKING_TECHNICIAN_EMAIL;
    let tech;
    if (techEmail) {
      tech = await prisma.user.findFirst({
        where: { email: techEmail, isActive: true },
        select: { id: true, name: true, email: true },
      });
    }
    if (!tech) {
      tech = await prisma.user.findFirst({
        where: { isActive: true, roles: { contains: 'TEKNIKER' } },
        select: { id: true, name: true, email: true },
      });
    }
    if (!tech) {
      console.error('No active technician found for Facebook lead');
      return NextResponse.json({ error: 'Ingen tekniker tilgjengelig' }, { status: 500 });
    }

    // Create TechVisit with status "ny"
    const visit = await prisma.techVisit.create({
      data: {
        technicianId: tech.id,
        unitNumber: '1',
        address: address || 'Ukjent adresse',
        postalCode: postalCode || null,
        ownerName: ownerName || null,
        ownerPhone: ownerPhone || null,
        ownerEmail: ownerEmail || null,
        notes: `Facebook Lead Ad (ID: ${leadgenId})`,
        status: 'ny',
      },
    });

    // Send notification emails
    const html = generateNotificationEmail({
      ownerName,
      ownerPhone,
      ownerEmail,
      address,
      postalCode,
      leadgenId,
      visitId: visit.id,
    });

    const emailPromises: Promise<unknown>[] = [];

    // To technician
    if (tech.email) {
      emailPromises.push(
        resend.emails
          .send({
            from: `Godt Vedlikehold <${fromEmail}>`,
            to: tech.email,
            subject: `Ny Facebook-lead – ${ownerName || 'Ukjent navn'}`,
            html,
          })
          .catch((err) => {
            console.error('Failed to send notification email to technician:', err);
          })
      );
    }

    // To admin
    emailPromises.push(
      resend.emails
        .send({
          from: `Godt Vedlikehold <${fromEmail}>`,
          to: 'hei@godtvedlikehold.no',
          subject: `Ny Facebook-lead – ${ownerName || 'Ukjent navn'}`,
          html,
        })
        .catch((err) => {
          console.error('Failed to send notification email to admin:', err);
        })
    );

    await Promise.all(emailPromises);

    return NextResponse.json({ success: true, visitId: visit.id }, { status: 200 });
  } catch (error) {
    console.error('Facebook lead webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

function generateNotificationEmail(data: {
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  address: string;
  postalCode: string;
  leadgenId: string;
  visitId: string;
}) {
  const rows = [
    { label: 'Navn', value: data.ownerName || '–' },
    { label: 'Telefon', value: data.ownerPhone || '–' },
    { label: 'E-post', value: data.ownerEmail || '–' },
    { label: 'Adresse', value: data.address || '–' },
    { label: 'Postnr', value: data.postalCode || '–' },
  ];

  const tableRows = rows
    .map(
      (r, i) =>
        `<tr${i > 0 ? ' style="border-top:1px solid rgba(26,26,46,0.06);"' : ''}><td style="padding:8px 0;color:#6B6B7B;">${r.label}</td><td style="padding:8px 0;font-weight:700;text-align:right;">${r.value}</td></tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"></head>
<body style="font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:0;color:#1A1A2E;background:#FAF7F2;">
  <div style="padding:32px 24px 0;">
    <p style="font-size:17px;font-weight:700;margin-bottom:4px;">Ny lead fra Facebook</p>
    <p style="font-size:15px;color:#2E2E48;line-height:1.6;margin-bottom:24px;">En ny kunde har meldt interesse via Facebook-annonsering. Kontaktinformasjon nedenfor:</p>

    <div style="background:#FFFFFF;border:1px solid rgba(26,26,46,0.08);border-radius:16px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;font-size:15px;border-collapse:collapse;">
        ${tableRows}
      </table>
    </div>

    <div style="background:#E8EFF8;border-radius:12px;padding:16px;font-size:14px;color:#1B3C73;line-height:1.6;margin-bottom:20px;">
      <strong>Neste steg:</strong><br>
      Ring kunden og avtal tid for ventilasjonsrens. Leaden er registrert i Konvoi som et nytt bes&oslash;k.
    </div>

    <p style="font-size:11px;color:#B5AFA5;line-height:1.6;">Lead-ID: ${data.leadgenId}<br>Visit-ID: ${data.visitId}</p>
  </div>

  <div style="margin-top:32px;padding:20px 24px;border-top:1px solid rgba(26,26,46,0.06);text-align:center;">
    <p style="font-size:11px;color:#B5AFA5;line-height:1.6;margin:0;">Godt Vedlikehold &mdash; Bedre inneklima, renere luft<br>Org.nr: 933 662 818</p>
  </div>
</body>
</html>`;
}
