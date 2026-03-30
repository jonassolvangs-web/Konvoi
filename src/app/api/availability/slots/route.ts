import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  timeToMinutes,
  subtractRanges,
  splitIntoSlots,
  getISODayOfWeek,
  toDateString,
  type TimeRange,
} from '@/lib/availability';

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
        const startMin = d.getHours() * 60 + d.getMinutes();
        return {
          date: toDateString(d),
          start: startMin,
          end: startMin + 120, // assume 2h per work order
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
        const startMin = d.getHours() * 60 + d.getMinutes();
        let endMin = startMin + 60; // default 1h
        if (apt.endAt) {
          const e = new Date(apt.endAt);
          endMin = e.getHours() * 60 + e.getMinutes();
        }
        return {
          date: toDateString(d),
          start: startMin,
          end: endMin,
        };
      });
    }

    // 4. For each day in range: resolve availability and subtract bookings
    const result: Record<string, { slots: { time: string; minutes: number }[]; windows: { start: string; end: string }[] }> = {};

    const current = new Date(fromDate);
    while (current <= toDate) {
      const dateStr = toDateString(current);
      const dow = getISODayOfWeek(current);

      // Date-specific overrides take priority
      const dayOverrides = overrides.filter(
        (o) => o.date && toDateString(new Date(o.date)) === dateStr
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
          // Default: available 07:00–19:00 (matches technician calendar default)
          availableRanges = [{ start: timeToMinutes('07:00'), end: timeToMinutes('19:00') }];
        }
      }

      // Subtract bookings for this day
      const dayBookings = bookings
        .filter((b) => b.date === dateStr)
        .map((b) => ({ start: b.start, end: b.end }));

      const freeWindows = subtractRanges(availableRanges, dayBookings);
      const slots = splitIntoSlots(freeWindows, slotDuration);

      if (availableRanges.length > 0 || slots.length > 0) {
        result[dateStr] = {
          slots,
          windows: freeWindows.map((w) => ({
            start: `${String(Math.floor(w.start / 60)).padStart(2, '0')}:${String(w.start % 60).padStart(2, '0')}`,
            end: `${String(Math.floor(w.end / 60)).padStart(2, '0')}:${String(w.end % 60).padStart(2, '0')}`,
          })),
        };
      }

      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json({ slots: result });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Availability slots error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
