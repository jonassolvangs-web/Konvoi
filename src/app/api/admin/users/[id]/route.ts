import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
  roles: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('ADMIN');
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        roles: true,
        activeRole: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            callRecords: true,
            appointments: true,
            visits: true,
            workOrders: true,
          },
        },
      },
    });

    if (!user) return NextResponse.json({ error: 'Bruker ikke funnet' }, { status: 404 });
    return NextResponse.json({ user: { ...user, roles: typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles } });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('ADMIN');
    const { id } = await params;

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    const data: any = { ...parsed.data };
    if (data.roles) {
      data.roles = JSON.stringify(data.roles);
    }
    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    return NextResponse.json({ user: { id: user.id, name: user.name } });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('ADMIN');
    const { id } = await params;

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
