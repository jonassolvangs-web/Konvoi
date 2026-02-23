import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const createAppointmentSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
  scheduledAt: z.string(),
  endAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || (session.user as any).id;
    const status = searchParams.get('status');

    const where: any = { userId };
    if (status) where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, address: true, numUnits: true, distanceFromOfficeKm: true, distanceFromOfficeMin: true } },
        user: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ appointments });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const bookerName = (session.user as any).name || 'Ukjent';

    const body = await req.json();
    const parsed = createAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ugyldig data', details: parsed.error.flatten() }, { status: 400 });
    }

    const appointment = await prisma.$transaction(async (tx) => {
      const scheduledDate = new Date(parsed.data.scheduledAt);
      const apt = await tx.appointment.create({
        data: {
          organizationId: parsed.data.organizationId,
          userId: parsed.data.userId,
          scheduledAt: scheduledDate,
          endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
          notes: parsed.data.notes || null,
        },
      });

      // Update org status
      await tx.organization.update({
        where: { id: parsed.data.organizationId },
        data: { status: 'mote_booket' },
      });

      const org = await tx.organization.findUnique({
        where: { id: parsed.data.organizationId },
        select: { name: true },
      });

      // Format date and time for chat message
      const dateStr = scheduledDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' });
      const timeStr = scheduledDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

      // Create system chat message with details
      await tx.chatMessage.create({
        data: {
          channelType: 'organization',
          channelId: parsed.data.organizationId,
          senderId: parsed.data.userId,
          organizationId: parsed.data.organizationId,
          content: `${bookerName} booket møte for ${dateStr} kl ${timeStr}`,
          isSystem: true,
        },
      });

      // Create notification for the assigned Feltselger
      await tx.notification.create({
        data: {
          userId: parsed.data.userId,
          title: 'Nytt møte booket',
          message: `${bookerName} booket møte med ${org?.name || 'ukjent sameie'} – ${dateStr} kl ${timeStr}`,
          type: 'info',
          linkUrl: '/feltselger/besok',
        },
      });

      return apt;
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Create appointment error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
