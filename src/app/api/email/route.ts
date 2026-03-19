import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAuth } from '@/lib/auth';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM || 'hei@godtvedlikehold.no';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { to, subject, html, reportHtml } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Mangler to, subject eller html' }, { status: 400 });
    }

    // Combine greeting + report into one email
    const fullHtml = reportHtml ? `${html}<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />${reportHtml}` : html;

    const { data, error } = await resend.emails.send({
      from: `Godt Vedlikehold <${fromEmail}>`,
      to,
      subject,
      html: fullHtml,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Kunne ikke sende e-post' }, { status: 500 });
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
