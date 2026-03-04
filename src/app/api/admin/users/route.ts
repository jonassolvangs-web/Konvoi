import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  roles: z.array(z.string()).min(1),
});

export async function GET() {
  try {
    await requireRole('ADMIN');

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        roles: true,
        activeRole: true,
        profileImageUrl: true,
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

    const parsed_users = users.map((u) => ({
      ...u,
      roles: typeof u.roles === 'string' ? JSON.parse(u.roles) : u.roles,
      profileImageUrl: u.profileImageUrl ? `/api/users/${u.id}/profile-image?v=1` : null,
    }));

    return NextResponse.json({ users: parsed_users });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('ADMIN');

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: 'E-postadressen er allerede i bruk' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        passwordHash,
        roles: JSON.stringify(parsed.data.roles),
        activeRole: parsed.data.roles[0],
      },
    });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
