import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const entrySchema = z.object({
  dayOfWeek: z.number().min(1).max(7).optional(),
  date: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isBlocked: z.boolean().optional(),
});

const createSchema = z.object({
  userId: z.string().optional(),
  entries: z.array(entrySchema).min(1),
});

const deleteSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const type = searchParams.get('type') || 'all';

    if (!userId) {
      return NextResponse.json({ error: 'userId kreves' }, { status: 400 });
    }

    const where: any = { userId };

    if (type === 'templates') {
      where.date = null;
      where.dayOfWeek = { not: null };
    } else if (type === 'overrides') {
      where.date = { not: null };
      if (from) where.date = { ...where.date, gte: new Date(from) };
      if (to) where.date = { ...where.date, lte: new Date(to + 'T23:59:59') };
    } else {
      // all — optionally filter date range for date-specific entries
      if (from || to) {
        where.OR = [
          { date: null }, // always include templates
          {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to + 'T23:59:59') } : {}),
            },
          },
        ];
      }
    }

    const availability = await prisma.availability.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json({ availability });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    const userId = parsed.data.userId || (session.user as any).id;

    const created = await prisma.$transaction(
      parsed.data.entries.map((entry) =>
        prisma.availability.create({
          data: {
            userId,
            dayOfWeek: entry.dayOfWeek ?? null,
            date: entry.date ? new Date(entry.date) : null,
            startTime: entry.startTime,
            endTime: entry.endTime,
            isBlocked: entry.isBlocked ?? false,
          },
        })
      )
    );

    return NextResponse.json({ availability: created }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create availability error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });
    }

    await prisma.availability.deleteMany({
      where: { id: { in: parsed.data.ids } },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
