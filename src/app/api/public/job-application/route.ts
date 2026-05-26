import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const navn = formData.get('navn') as string;
    const alder = formData.get('alder') as string;
    const by = formData.get('by') as string;
    const epost = formData.get('epost') as string;
    const telefon = formData.get('telefon') as string;
    const melding = formData.get('melding') as string || '';
    const photo = formData.get('photo') as File | null;

    if (!navn || !alder || !by || !epost || !telefon) {
      return NextResponse.json({ error: 'Mangler påkrevde felter' }, { status: 400, headers: corsHeaders });
    }

    const attachments: { filename: string; content: Buffer }[] = [];

    if (photo && photo.size > 0) {
      const bytes = await photo.arrayBuffer();
      attachments.push({
        filename: photo.name || 'bilde.jpg',
        content: Buffer.from(bytes),
      });
    }

    await resend.emails.send({
      from: 'KONVOY <hei@konvoy.no>',
      to: 'hei@konvoy.no',
      subject: `Ny jobbsøknad fra ${navn}`,
      html: `
<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;background:#fafafa;">
  <h2 style="margin-bottom:24px;">Ny jobbsøknad</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#666;">Navn</td><td style="padding:10px 0;font-weight:600;text-align:right;">${navn}</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#666;">Alder</td><td style="padding:10px 0;font-weight:600;text-align:right;">${alder}</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#666;">By</td><td style="padding:10px 0;font-weight:600;text-align:right;">${by}</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#666;">E-post</td><td style="padding:10px 0;font-weight:600;text-align:right;"><a href="mailto:${epost}">${epost}</a></td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#666;">Telefon</td><td style="padding:10px 0;font-weight:600;text-align:right;"><a href="tel:${telefon}">${telefon}</a></td></tr>
    ${melding ? `<tr><td style="padding:10px 0;color:#666;" colspan="2"><strong>Melding:</strong><br>${melding.replace(/\n/g, '<br>')}</td></tr>` : ''}
  </table>
  ${photo && photo.size > 0 ? '<p style="margin-top:16px;color:#666;font-size:13px;">Bilde vedlagt.</p>' : ''}
</body>
</html>`,
      attachments,
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('Job application error:', error);
    return NextResponse.json({ error: 'Kunne ikke sende søknad' }, { status: 500, headers: corsHeaders });
  }
}
