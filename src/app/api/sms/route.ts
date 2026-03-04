import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';

const sendSmsSchema = z.object({
  to: z.string().min(8),
  message: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const parsed = sendSmsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });
    }

    const { to, message } = parsed.data;

    // TODO: Integrer med SMS-leverandør (Twilio, Sveve, etc.)
    // For nå logger vi bare meldingen
    console.log(`[SMS] Til: ${to} | Melding: ${message}`);

    return NextResponse.json({ success: true, message: 'SMS sendt (placeholder)' });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }
    console.error('SMS send error:', error);
    return NextResponse.json({ error: 'Kunne ikke sende SMS' }, { status: 500 });
  }
}
