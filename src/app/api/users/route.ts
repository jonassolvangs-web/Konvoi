import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, roles: true, profileImageUrl: true },
      orderBy: { name: 'asc' },
    });

    let parsed = users.map((u) => ({
      ...u,
      roles: typeof u.roles === 'string' ? JSON.parse(u.roles) : u.roles,
    }));

    if (role) {
      parsed = parsed.filter((u: any) => u.roles.includes(role));
    }

    return NextResponse.json({ users: parsed });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
