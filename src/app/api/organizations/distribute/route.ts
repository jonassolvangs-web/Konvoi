import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';

const distributeSchema = z.object({
  userIds: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole('ADMIN');

    const body = await req.json();
    const parsed = distributeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });
    }

    const { userIds } = parsed.data;

    // Get all unassigned organizations
    const unassigned = await prisma.organization.findMany({
      where: { status: 'ikke_tildelt' },
      orderBy: { name: 'asc' },
    });

    if (unassigned.length === 0) {
      return NextResponse.json({ error: 'Ingen utildelte adresser' }, { status: 400 });
    }

    // Distribute evenly
    for (let i = 0; i < unassigned.length; i++) {
      const userId = userIds[i % userIds.length];
      await prisma.organization.update({
        where: { id: unassigned[i].id },
        data: { assignedToId: userId, status: 'tildelt' },
      });
    }

    return NextResponse.json({ success: true, count: unassigned.length });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Distribute error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
