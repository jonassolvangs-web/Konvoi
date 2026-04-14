import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAuth } from '@/lib/auth';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'hei@godtvedlikehold.no';

/**
 * Extract data URI images from HTML, replace with cid: references,
 * and return inline attachments for Resend.
 */
function extractInlineImages(html: string) {
  const inlineAttachments: { filename: string; content: Buffer; contentId: string }[] = [];
  let imageIndex = 0;

  const processedHtml = html.replace(
    /src="(data:(image\/(jpeg|png|webp|gif));base64,([^"]+))"/g,
    (_match, _fullDataUri, _mimeType, ext, base64Data) => {
      imageIndex++;
      const contentId = `image-${imageIndex}`;
      const filename = `image-${imageIndex}.${ext === 'jpeg' ? 'jpg' : ext}`;

      inlineAttachments.push({
        filename,
        content: Buffer.from(base64Data, 'base64'),
        contentId,
      });

      return `src="cid:${contentId}"`;
    }
  );

  return { processedHtml, inlineAttachments };
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { to, subject, html, pdfBase64 } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Mangler to, subject eller html' }, { status: 400 });
    }

    // Extract data URI images and convert to inline CID attachments
    const { processedHtml, inlineAttachments } = extractInlineImages(html);

    const attachments: { filename: string; content: Buffer; contentId?: string }[] = [
      ...inlineAttachments,
    ];

    if (pdfBase64) {
      attachments.push({
        filename: 'Rapport-Ventilasjonsrens.pdf',
        content: Buffer.from(pdfBase64, 'base64'),
      });
    }

    // Send separate emails to each recipient
    const recipients = Array.isArray(to) ? to : [to];
    const results = [];

    for (const recipient of recipients) {
      console.log(`Sending email to: ${recipient}, subject: ${subject}`);
      const { data, error } = await resend.emails.send({
        from: `Godt Vedlikehold <${fromEmail}>`,
        to: recipient,
        subject,
        html: processedHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      if (error) {
        console.error(`Resend error for ${recipient}:`, JSON.stringify(error));
        results.push({ to: recipient, error: error.message || JSON.stringify(error) });
      } else {
        console.log(`Email sent to ${recipient} - ID: ${data?.id}`);
        results.push({ to: recipient, id: data?.id });
      }
    }

    const failed = results.filter(r => r.error);
    if (failed.length === results.length) {
      return NextResponse.json({ error: `Kunne ikke sende e-post: ${failed[0].error}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }
    console.error('Email error:', error);
    return NextResponse.json({ error: 'Kunne ikke sende e-post' }, { status: 500 });
  }
}
