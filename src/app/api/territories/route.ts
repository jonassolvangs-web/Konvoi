import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  polygon: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.array(z.number()))),
  }),
});

export async function GET() {
  try {
    await requireRole('ADMIN');

    const territories = await prisma.territory.findMany({
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ territories });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('ADMIN');

    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    const territory = await prisma.territory.create({
      data: {
        name: parsed.data.name,
        color: parsed.data.color,
        polygon: parsed.data.polygon,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ territory }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Create territory error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
