import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';

const registerCallSchema = z.object({
  organizationId: z.string(),
  result: z.enum(['mote_booket', 'ikke_svar', 'ring_tilbake', 'nei', 'mail_sendt']),
  notes: z.string().optional(),
  callbackAt: z.string().optional(),
  duration: z.number().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole('ADMIN', 'MOTEBOOKER');
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || (session.user as any).id;
    const organizationId = searchParams.get('organizationId');

    const where: any = organizationId ? { organizationId } : { userId };

    const calls = await prisma.callRecord.findMany({
      where,
      include: {
        organization: { select: { name: true, address: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ calls });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole('MOTEBOOKER', 'ADMIN');
    const userId = (session.user as any).id;

    const body = await req.json();
    const parsed = registerCallSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    const { organizationId, result, notes, callbackAt, duration } = parsed.data;

    const call = await prisma.$transaction(async (tx) => {
      const record = await tx.callRecord.create({
        data: {
          organizationId,
          userId,
          result,
          notes: notes || null,
          callbackAt: callbackAt ? new Date(callbackAt) : null,
          duration: duration || null,
        },
      });

      // Update org status based on result
      const statusMap: Record<string, string> = {
        mote_booket: 'mote_booket',
      };

      const newStatus = statusMap[result];
      if (newStatus) {
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            status: newStatus as any,
            lastContactedAt: new Date(),
          },
        });
      } else {
        await tx.organization.update({
          where: { id: organizationId },
          data: { lastContactedAt: new Date() },
        });
      }

      return record;
    });

    return NextResponse.json({ call }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Register call error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
