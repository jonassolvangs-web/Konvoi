import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  timeToMinutes,
  subtractRanges,
  splitIntoSlots,
  type TimeRange,
} from '@/lib/availability';

const TZ = 'Europe/Oslo';
const dtf = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

function getNorwayParts(date: Date) {
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0');
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

function toNorwayDateString(date: Date): string {
  const p = getNorwayParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function getNorwayMinutes(date: Date): number {
  const p = getNorwayParts(date);
  return p.hour * 60 + p.minute;
}

function getNorwayDayOfWeek(date: Date): number {
  const p = getNorwayParts(date);
  const d = new Date(p.year, p.month - 1, p.day);
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Public endpoint — no auth required.
 * Returns available booking slots for the configured technician.
 *
 * GET /api/public/booking/slots?from=2026-04-21&to=2026-04-30
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const slotDuration = parseInt(searchParams.get('slotDuration') || '60', 10);

    if (!from || !to) {
      return NextResponse.json({ error: 'from og to kreves' }, { status: 400 });
    }

    // Find the technician to show availability for.
    // Uses BOOKING_TECHNICIAN_EMAIL env var, falls back to first active TEKNIKER.
    const techEmail = process.env.BOOKING_TECHNICIAN_EMAIL;
    let user;
    if (techEmail) {
      user = await prisma.user.findFirst({
        where: { email: techEmail, isActive: true },
        select: { id: true },
      });
    }
    if (!user) {
      user = await prisma.user.findFirst({
        where: { isActive: true, roles: { contains: 'TEKNIKER' } },
        select: { id: true },
      });
    }
    if (!user) {
      return NextResponse.json({ error: 'Ingen tekniker konfigurert' }, { status: 500 });
    }

    const userId = user.id;
    const fromDate = new Date(from);
    const toDate = new Date(to + 'T23:59:59');

    // Weekly availability templates
    const templates = await prisma.availability.findMany({
      where: { userId, date: null, dayOfWeek: { not: null } },
    });

    // Date-specific overrides
    const overrides = await prisma.availability.findMany({
      where: { userId, date: { gte: fromDate, lte: toDate } },
    });

    // Existing work orders (booked slots)
    const workOrders = await prisma.workOrder.findMany({
      where: {
        technicianId: userId,
        scheduledAt: { gte: fromDate, lte: toDate },
        status: { not: 'fullfort' },
      },
      select: { scheduledAt: true },
    });

    const bookings = workOrders.map((wo) => {
      const d = new Date(wo.scheduledAt);
      const startMin = getNorwayMinutes(d);
      return {
        date: toNorwayDateString(d),
        start: startMin,
        end: startMin + slotDuration,
      };
    });

    // Build slots per day
    const result: Record<string, { time: string; minutes: number }[]> = {};

    const current = new Date(fromDate);
    while (current <= toDate) {
      const dateStr = toNorwayDateString(current);
      const dow = getNorwayDayOfWeek(current);

      // Skip weekends
      if (dow === 6 || dow === 7) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Resolve available ranges
      const dayOverrides = overrides.filter(
        (o) => o.date && toNorwayDateString(new Date(o.date)) === dateStr
      );

      let availableRanges: TimeRange[];

      if (dayOverrides.length > 0) {
        const blockedOverrides = dayOverrides.filter((o) => o.isBlocked);
        const availableOverrides = dayOverrides.filter((o) => !o.isBlocked);

        const isFullDayBlock = blockedOverrides.some(
          (o) => o.startTime === '00:00' && o.endTime >= '23:59'
        );

        if (isFullDayBlock) {
          availableRanges = [];
        } else if (availableOverrides.length > 0) {
          availableRanges = availableOverrides.map((o) => ({
            start: timeToMinutes(o.startTime),
            end: timeToMinutes(o.endTime),
          }));
          const blockedRanges = blockedOverrides.map((o) => ({
            start: timeToMinutes(o.startTime),
            end: timeToMinutes(o.endTime),
          }));
          availableRanges = subtractRanges(availableRanges, blockedRanges);
        } else {
          const defaultRange = [{ start: 0, end: 1440 }];
          const blockedRanges = blockedOverrides.map((o) => ({
            start: timeToMinutes(o.startTime),
            end: timeToMinutes(o.endTime),
          }));
          availableRanges = subtractRanges(defaultRange, blockedRanges);
        }
      } else {
        const dayTemplates = templates.filter((t) => t.dayOfWeek === dow);
        if (dayTemplates.length > 0) {
          availableRanges = dayTemplates.map((t) => ({
            start: timeToMinutes(t.startTime),
            end: timeToMinutes(t.endTime),
          }));
        } else {
          // No templates — default 10:00-20:00
          availableRanges = [{ start: 600, end: 1200 }];
        }
      }

      // Subtract existing bookings
      const dayBookings = bookings
        .filter((b) => b.date === dateStr)
        .map((b) => ({ start: b.start, end: b.end }));

      const freeWindows = subtractRanges(availableRanges, dayBookings);
      const slots = splitIntoSlots(freeWindows, slotDuration);

      if (slots.length > 0) {
        result[dateStr] = slots;
      }

      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json({ slots: result });
  } catch (error) {
    console.error('Public booking slots error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
