import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Mangler to, subject eller html' }, { status: 400 });
    }

    // TODO: Integrer med SendGrid
    console.log('=== E-POST ===');
    console.log(`Til: ${to}`);
    console.log(`Emne: ${subject}`);
    console.log(`Innhold: ${html.substring(0, 200)}...`);
    console.log('==============');

    return NextResponse.json({ success: true, message: 'E-post sendt (placeholder)' });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }
    console.error('Email error:', error);
    return NextResponse.json({ error: 'Kunne ikke sende e-post' }, { status: 500 });
  }
}
