import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAuth } from '@/lib/auth';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'hei@godtvedlikehold.no';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { to, subject, html, pdfBase64 } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Mangler to, subject eller html' }, { status: 400 });
    }

    const attachments = pdfBase64
      ? [{ filename: 'Rapport-Ventilasjonsrens.pdf', content: Buffer.from(pdfBase64, 'base64') }]
      : undefined;

    const { data, error } = await resend.emails.send({
      from: `Godt Vedlikehold <${fromEmail}>`,
      to,
      subject,
      html,
      attachments,
    });

    if (error) {
      console.error('Resend error:', JSON.stringify(error));
      return NextResponse.json({ error: `Kunne ikke sende e-post: ${error.message || JSON.stringify(error)}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }
    console.error('Email error:', error);
    return NextResponse.json({ error: 'Kunne ikke sende e-post' }, { status: 500 });
  }
}
