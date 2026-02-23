import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    await requireRole('ADMIN');

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    const [
      totalCalls,
      totalAppointments,
      totalVisits,
      totalWorkOrders,
      weekCalls,
      weekAppointments,
      weekUnitsSold,
      weekWorkOrdersDone,
      weekRevenue,
      pendingPayments,
      vippsPending,
      invoicePending,
      paymentPlans,
      upcomingRenewals,
    ] = await Promise.all([
      prisma.callRecord.count(),
      prisma.appointment.count(),
      prisma.visit.count(),
      prisma.workOrder.count(),
      prisma.callRecord.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.appointment.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.dwellingUnit.count({ where: { visitStatus: 'solgt', createdAt: { gte: weekStart } } }),
      prisma.workOrder.count({ where: { status: 'fullfort', completedAt: { gte: weekStart } } }),
      prisma.workOrderUnit.aggregate({
        where: { completedAt: { gte: weekStart } },
        _sum: { price: true },
      }),
      prisma.workOrderUnit.aggregate({
        where: { paymentStatus: { in: ['ikke_betalt', 'vipps_sendt', 'faktura_sendt'] } },
        _sum: { price: true },
      }),
      prisma.workOrderUnit.aggregate({
        where: { paymentStatus: 'vipps_sendt' },
        _sum: { price: true },
      }),
      prisma.workOrderUnit.aggregate({
        where: { paymentStatus: 'faktura_sendt' },
        _sum: { price: true },
      }),
      prisma.workOrderUnit.count({ where: { paymentStatus: 'plan_aktiv' } }),
      prisma.cleaningHistory.findMany({
        where: { reminderStatus: { in: ['innen_6mnd', 'innen_3mnd', 'forfalt'] } },
        include: { organization: { select: { name: true, address: true } } },
        orderBy: { nextCleaningDate: 'asc' },
      }),
    ]);

    return NextResponse.json({
      totals: {
        calls: totalCalls,
        appointments: totalAppointments,
        visits: totalVisits,
        workOrders: totalWorkOrders,
      },
      thisWeek: {
        calls: weekCalls,
        appointments: weekAppointments,
        unitsSold: weekUnitsSold,
        workOrdersDone: weekWorkOrdersDone,
        revenue: weekRevenue._sum.price || 0,
      },
      payments: {
        totalPending: pendingPayments._sum.price || 0,
        vippsPending: vippsPending._sum.price || 0,
        invoicePending: invoicePending._sum.price || 0,
        paymentPlans: paymentPlans,
      },
      upcomingRenewals,
    });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }
    if (error.message === 'Ingen tilgang') {
      return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    }
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
