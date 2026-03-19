import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAuth } from '@/lib/auth';
import { generatePdfFromHtml } from '@/lib/pdf';

export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM || 'hei@godtvedlikehold.no';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { to, subject, html, reportHtml, attachment } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Mangler to, subject eller html' }, { status: 400 });
    }

    let attachments: { filename: string; content: Buffer }[] | undefined;

    if (attachment && reportHtml) {
      const pdfBuffer = await generatePdfFromHtml(reportHtml);
      attachments = [
        {
          filename: 'rapport.pdf',
          content: pdfBuffer,
        },
      ];
    }

    const { data, error } = await resend.emails.send({
      from: `Godt Vedlikehold <${fromEmail}>`,
      to,
      subject,
      html,
      attachments,
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
