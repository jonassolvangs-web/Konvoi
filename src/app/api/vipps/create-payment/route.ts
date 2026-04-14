import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createPayment } from '@/lib/vipps';

function normalizePhone(phone: string): string {
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-()]/g, '');
  // Add country code if missing
  if (cleaned.startsWith('4') && cleaned.length === 8) {
    cleaned = '47' + cleaned;
  } else if (cleaned.startsWith('+47')) {
    cleaned = cleaned.slice(1); // remove +
  } else if (cleaned.length === 8) {
    cleaned = '47' + cleaned;
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { workOrderUnitId } = await req.json();

    if (!workOrderUnitId) {
      return NextResponse.json({ error: 'workOrderUnitId er påkrevd' }, { status: 400 });
    }

    // Fetch unit with dwelling unit for customer phone
    const unit = await prisma.workOrderUnit.findUnique({
      where: { id: workOrderUnitId },
      include: {
        dwellingUnit: true,
        workOrder: { include: { organization: true } },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Enhet ikke funnet' }, { status: 404 });
    }

    const customerPhone = unit.dwellingUnit.residentPhone;
    if (!customerPhone) {
      return NextResponse.json({ error: 'Kunden har ikke registrert telefonnummer' }, { status: 400 });
    }

    const reference = `turbo-${unit.id}-${Date.now()}`;
    const amountInOre = Math.round(unit.price * 100);
    const description = `${unit.productName || 'Ventilasjonsrens'} – ${unit.workOrder.organization.name}`;

    const baseUrl = process.env.NEXTAUTH_URL || 'https://turbo.no';
    const callbackUrl = `${baseUrl}/api/vipps/callback`;

    const result = await createPayment({
      reference,
      amountInOre,
      customerPhoneNumber: normalizePhone(customerPhone),
      description,
      callbackUrl,
    });

    // Save reference and update payment status
    await prisma.workOrderUnit.update({
      where: { id: workOrderUnitId },
      data: {
        vippsReference: reference,
        paymentStatus: 'vipps_sendt',
      },
    });

    return NextResponse.json({ reference, vippsResponse: result });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }
    console.error('Vipps create-payment error:', error);
    return NextResponse.json({ error: error.message || 'Kunne ikke opprette Vipps-betaling' }, { status: 500 });
  }
}
