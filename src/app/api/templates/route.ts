import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const createSchema = z.object({
  type: z.enum(['sms', 'email']),
  title: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export async function GET() {
  try {
    await requireAuth();
    const templates = await prisma.smsTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ templates });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Ugyldig data' }, { status: 400 });

    const template = await prisma.smsTemplate.create({ data: parsed.data });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
