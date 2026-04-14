import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { capturePayment } from '@/lib/vipps';

// No auth - this is a Vipps webhook endpoint
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const reference = body.reference;
    const state = body.name; // Event name: AUTHORIZED, ABORTED, EXPIRED, TERMINATED, etc.

    if (!reference) {
      return NextResponse.json({ ok: true }); // Always return 200 to Vipps
    }

    const unit = await prisma.workOrderUnit.findUnique({
      where: { vippsReference: reference },
    });

    if (!unit) {
      // Unknown reference, still return 200
      return NextResponse.json({ ok: true });
    }

    if (state === 'AUTHORIZED') {
      // Auto-capture
      const amountInOre = Math.round(unit.price * 100);
      try {
        await capturePayment(reference, amountInOre);
      } catch (e) {
        console.error('Vipps callback capture error:', e);
        // Still mark as betalt if capture fails (might already be captured)
      }

      await prisma.workOrderUnit.update({
        where: { vippsReference: reference },
        data: { paymentStatus: 'betalt' },
      });
    } else if (state === 'ABORTED' || state === 'EXPIRED' || state === 'TERMINATED') {
      await prisma.workOrderUnit.update({
        where: { vippsReference: reference },
        data: {
          paymentStatus: 'ikke_betalt',
          vippsReference: null,
        },
      });
    }

    // Always return 200 to Vipps
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Vipps callback error:', error);
    // Always return 200 to prevent Vipps retries on our errors
    return NextResponse.json({ ok: true });
  }
}
