import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  timeToMinutes,
  subtractRanges,
  splitIntoSlots,
  getISODayOfWeek,
  type TimeRange,
} from '@/lib/availability';

const TZ = 'Europe/Oslo';
const dtf = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

/** Parse date into Norwegian timezone components */
function getNorwayParts(date: Date) {
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0');
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** Get YYYY-MM-DD in Norwegian timezone */
function toNorwayDateString(date: Date): string {
  const p = getNorwayParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Get minutes from midnight in Norwegian timezone */
function getNorwayMinutes(date: Date): number {
  const p = getNorwayParts(date);
  return p.hour * 60 + p.minute;
}

/** Get ISO day of week (1=Mon, 7=Sun) in Norwegian timezone */
function getNorwayDayOfWeek(date: Date): number {
  const p = getNorwayParts(date);
  const d = new Date(p.year, p.month - 1, p.day);
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const slotDuration = parseInt(searchParams.get('slotDuration') || '30', 10);

    if (!userId || !from || !to) {
      return NextResponse.json({ error: 'userId, from og to kreves' }, { status: 400 });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to + 'T23:59:59');

    // 1. Get weekly templates
    const templates = await prisma.availability.findMany({
      where: { userId, date: null, dayOfWeek: { not: null } },
    });

    // 2. Get date-specific overrides in range
    const overrides = await prisma.availability.findMany({
      where: { userId, date: { gte: fromDate, lte: toDate } },
    });

    // 3. Get existing bookings in range
    // Check user role to determine booking type
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });

    const roles: string[] = user?.roles ? JSON.parse(user.roles) : [];
    const isTechnician = roles.includes('TEKNIKER');

    let bookings: { date: string; start: number; end: number }[] = [];

    if (isTechnician) {
      const workOrders = await prisma.workOrder.findMany({
        where: {
          technicianId: userId,
          scheduledAt: { gte: fromDate, lte: toDate },
          status: { not: 'fullfort' },
        },
        select: { scheduledAt: true },
      });
      bookings = workOrders.map((wo) => {
        const d = new Date(wo.scheduledAt);
        const startMin = getNorwayMinutes(d);
        return {
          date: toNorwayDateString(d),
          start: startMin,
          end: startMin + 30,
        };
      });
    } else {
      const appointments = await prisma.appointment.findMany({
        where: {
          userId,
          scheduledAt: { gte: fromDate, lte: toDate },
          status: { not: 'kansellert' },
        },
        select: { scheduledAt: true, endAt: true },
      });
      bookings = appointments.map((apt) => {
        const d = new Date(apt.scheduledAt);
        const startMin = getNorwayMinutes(d);
        let endMin = startMin + 60; // default 1h
        if (apt.endAt) {
          endMin = getNorwayMinutes(new Date(apt.endAt));
        }
        return {
          date: toNorwayDateString(d),
          start: startMin,
          end: endMin,
        };
      });
    }

    // 4. For each day in range: resolve availability and subtract bookings
    const result: Record<string, {
      slots: { time: string; minutes: number }[];
      windows: { start: string; end: string }[];
      bookings: { time: string; minutes: number }[];
      availableRanges: { start: string; end: string }[];
    }> = {};

    const current = new Date(fromDate);
    while (current <= toDate) {
      const dateStr = toNorwayDateString(current);
      const dow = getNorwayDayOfWeek(current);

      // Date-specific overrides take priority
      const dayOverrides = overrides.filter(
        (o) => o.date && toNorwayDateString(new Date(o.date)) === dateStr
      );

      let availableRanges: TimeRange[];

      if (dayOverrides.length > 0) {
        // Check if any override is a block (entire day blocked)
        const hasBlock = dayOverrides.some((o) => o.isBlocked);
        if (hasBlock) {
          availableRanges = [];
        } else {
          availableRanges = dayOverrides
            .filter((o) => !o.isBlocked)
            .map((o) => ({
              start: timeToMinutes(o.startTime),
              end: timeToMinutes(o.endTime),
            }));
        }
      } else {
        // Fall back to weekly templates
        const dayTemplates = templates.filter((t) => t.dayOfWeek === dow);
        if (dayTemplates.length > 0) {
          availableRanges = dayTemplates.map((t) => ({
            start: timeToMinutes(t.startTime),
            end: timeToMinutes(t.endTime),
          }));
        } else {
          // Default: available entire day
          availableRanges = [{ start: 0, end: 1440 }];
        }
      }

      // Subtract bookings for this day
      const dayBookings = bookings
        .filter((b) => b.date === dateStr)
        .map((b) => ({ start: b.start, end: b.end }));

      const freeWindows = subtractRanges(availableRanges, dayBookings);
      const slots = splitIntoSlots(freeWindows, slotDuration);

      // Always include the day (even if no slots) so the component can show all time slots
      result[dateStr] = {
        slots,
        windows: freeWindows.map((w) => ({
          start: `${String(Math.floor(w.start / 60)).padStart(2, '0')}:${String(w.start % 60).padStart(2, '0')}`,
          end: `${String(Math.floor(w.end / 60)).padStart(2, '0')}:${String(w.end % 60).padStart(2, '0')}`,
        })),
        bookings: dayBookings.map((b) => ({
          time: `${String(Math.floor(b.start / 60)).padStart(2, '0')}:${String(b.start % 60).padStart(2, '0')}`,
          minutes: b.start,
        })),
        availableRanges: availableRanges.map((r) => ({
          start: `${String(Math.floor(r.start / 60)).padStart(2, '0')}:${String(r.start % 60).padStart(2, '0')}`,
          end: `${String(Math.floor(r.end / 60)).padStart(2, '0')}:${String(r.end % 60).padStart(2, '0')}`,
        })),
      };

      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json({ slots: result });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Availability slots error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
