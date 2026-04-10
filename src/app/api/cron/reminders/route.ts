import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';

/**
 * Cron job: Send reminders for upcoming work orders.
 * Runs daily at 07:00 via Vercel Cron.
 *
 * Sends two types of reminders:
 * 1. Day-before: for all work orders scheduled tomorrow
 * 2. Same-day: for all work orders scheduled today
 *
 * Uses notification deduplication via linkUrl to avoid duplicates.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    let created = 0;

    // Today: midnight to midnight
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Tomorrow: midnight to midnight
    const tomorrowStart = new Date(todayEnd);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    // Find all motebookers to also notify them
    const motebookers = await prisma.user.findMany({
      where: { roles: { contains: 'MOTEBOOKER' } },
      select: { id: true },
    });

    // Helper: send reminder to a user (with dedup)
    async function sendReminder(
      userId: string,
      title: string,
      message: string,
      dedupKey: string,
      linkUrl: string
    ) {
      const existing = await prisma.notification.findFirst({
        where: { userId, linkUrl: dedupKey },
      });
      if (existing) return false;

      await prisma.notification.create({
        data: { userId, title, message, type: 'reminder', linkUrl: dedupKey },
      });

      try {
        await sendPushToUser(userId, { title, body: message, url: linkUrl });
      } catch {
        // Push may fail if no subscription
      }
      return true;
    }

    // ── 1. Day-before reminders (tomorrow's work orders) ──
    const tomorrowOrders = await prisma.workOrder.findMany({
      where: {
        scheduledAt: { gte: tomorrowStart, lt: tomorrowEnd },
        status: 'planlagt',
      },
      include: {
        organization: { select: { name: true, address: true } },
        technician: { select: { id: true, name: true } },
      },
    });

    for (const wo of tomorrowOrders) {
      const date = wo.scheduledAt.toLocaleDateString('nb-NO', {
        timeZone: 'Europe/Oslo',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      const time = wo.scheduledAt.toLocaleTimeString('nb-NO', {
        timeZone: 'Europe/Oslo',
        hour: '2-digit',
        minute: '2-digit',
      });

      const title = 'Oppdrag i morgen';
      const message = `${wo.organization.name} – ${date} kl ${time}, ${wo.organization.address}`;
      const techLink = `/tekniker/oppdrag/${wo.id}`;

      // Notify technician
      if (await sendReminder(wo.technician.id, title, message, `${techLink}?reminder=day`, techLink)) {
        created++;
      }

      // Notify all motebookers
      for (const mb of motebookers) {
        const mbDedup = `/motebooker/oversikt?wo=${wo.id}&reminder=day`;
        if (await sendReminder(mb.id, title, `${wo.technician.name}: ${message}`, mbDedup, '/motebooker/oversikt')) {
          created++;
        }
      }
    }

    // ── 2. Same-day reminders (today's work orders) ──
    const todayOrders = await prisma.workOrder.findMany({
      where: {
        scheduledAt: { gte: todayStart, lt: todayEnd },
        status: 'planlagt',
      },
      include: {
        organization: { select: { name: true, address: true } },
        technician: { select: { id: true, name: true } },
        units: { select: { id: true } },
      },
    });

    for (const wo of todayOrders) {
      const time = wo.scheduledAt.toLocaleTimeString('nb-NO', {
        timeZone: 'Europe/Oslo',
        hour: '2-digit',
        minute: '2-digit',
      });

      const title = `Oppdrag i dag kl ${time}`;
      const message = `${wo.organization.name}, ${wo.organization.address} – ${wo.units.length} enhet${wo.units.length !== 1 ? 'er' : ''}`;
      const techLink = `/tekniker/oppdrag/${wo.id}`;

      // Notify technician
      if (await sendReminder(wo.technician.id, title, message, `${techLink}?reminder=today`, techLink)) {
        created++;
      }

      // Notify all motebookers
      for (const mb of motebookers) {
        const mbDedup = `/motebooker/oversikt?wo=${wo.id}&reminder=today`;
        if (await sendReminder(mb.id, title, `${wo.technician.name}: ${message}`, mbDedup, '/motebooker/oversikt')) {
          created++;
        }
      }
    }

    return NextResponse.json({ ok: true, reminders: created });
  } catch (error) {
    console.error('Cron reminders error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
