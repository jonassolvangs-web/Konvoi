import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';

const assignSchema = z.object({
  organizationIds: z.array(z.string()).min(1),
  userId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole('ADMIN');

    const body = await req.json();
    const parsed = assignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });
    }

    const { organizationIds, userId } = parsed.data;

    await prisma.organization.updateMany({
      where: { id: { in: organizationIds } },
      data: {
        assignedToId: userId,
        status: 'tildelt',
      },
    });

    return NextResponse.json({ success: true, count: organizationIds.length });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Assign error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
