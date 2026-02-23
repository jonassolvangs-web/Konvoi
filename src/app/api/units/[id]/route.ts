import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const unit = await prisma.dwellingUnit.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, address: true } },
        visit: { select: { id: true, status: true } },
      },
    });

    if (!unit) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
    return NextResponse.json({ unit });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const unit = await prisma.$transaction(async (tx) => {
      const updated = await tx.dwellingUnit.update({
        where: { id },
        data: body,
      });

      // Recalculate visit stats whenever visitStatus changes
      if (body.visitStatus !== undefined && updated.visitId) {
        const soldCount = await tx.dwellingUnit.count({
          where: { visitId: updated.visitId, visitStatus: 'solgt' },
        });
        const totalRevenue = await tx.dwellingUnit.aggregate({
          where: { visitId: updated.visitId, visitStatus: 'solgt' },
          _sum: { price: true },
        });
        await tx.visit.update({
          where: { id: updated.visitId },
          data: {
            unitsSold: soldCount,
            totalRevenue: totalRevenue._sum.price || 0,
          },
        });
      }

      return updated;
    });

    return NextResponse.json({ unit });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Update unit error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
