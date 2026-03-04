import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const updateSchema = z.object({
  dayOfWeek: z.number().min(1).max(7).optional().nullable(),
  date: z.string().optional().nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  isBlocked: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    const data: any = {};
    if (parsed.data.dayOfWeek !== undefined) data.dayOfWeek = parsed.data.dayOfWeek;
    if (parsed.data.date !== undefined) data.date = parsed.data.date ? new Date(parsed.data.date) : null;
    if (parsed.data.startTime) data.startTime = parsed.data.startTime;
    if (parsed.data.endTime) data.endTime = parsed.data.endTime;
    if (parsed.data.isBlocked !== undefined) data.isBlocked = parsed.data.isBlocked;

    const updated = await prisma.availability.update({
      where: { id },
      data,
    });

    return NextResponse.json({ availability: updated });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.code === 'P2025') return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    await prisma.availability.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.code === 'P2025') return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
