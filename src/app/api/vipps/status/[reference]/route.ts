import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getPaymentStatus, capturePayment } from '@/lib/vipps';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    await requireAuth();
    const { reference } = await params;

    const vippsStatus = await getPaymentStatus(reference);
    const state = vippsStatus.state;

    if (state === 'AUTHORIZED') {
      // Auto-capture the payment
      const unit = await prisma.workOrderUnit.findUnique({
        where: { vippsReference: reference },
      });

      if (unit) {
        const amountInOre = Math.round(unit.price * 100);
        await capturePayment(reference, amountInOre);

        await prisma.workOrderUnit.update({
          where: { vippsReference: reference },
          data: { paymentStatus: 'betalt' },
        });
      }

      return NextResponse.json({ status: 'betalt', vippsState: state });
    }

    if (state === 'ABORTED' || state === 'EXPIRED' || state === 'TERMINATED') {
      // Reset payment status
      await prisma.workOrderUnit.update({
        where: { vippsReference: reference },
        data: {
          paymentStatus: 'ikke_betalt',
          vippsReference: null,
        },
      });

      return NextResponse.json({ status: 'avbrutt', vippsState: state });
    }

    // CREATED or other intermediate states
    return NextResponse.json({ status: 'venter', vippsState: state });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }
    console.error('Vipps status error:', error);
    return NextResponse.json({ error: error.message || 'Kunne ikke hente status' }, { status: 500 });
  }
}
