import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }

    const { role } = await req.json();
    const userRoles = (session.user as any).roles as string[];

    if (!userRoles.includes(role)) {
      return NextResponse.json({ error: 'Ingen tilgang til denne rollen' }, { status: 403 });
    }

    // Update activeRole in database
    await prisma.user.update({
      where: { id: (session.user as any).id },
      data: { activeRole: role },
    });

    return NextResponse.json({ success: true, activeRole: role });
  } catch (error) {
    console.error('Switch role error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
