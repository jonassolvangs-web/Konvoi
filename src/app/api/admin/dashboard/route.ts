import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DEMO_DASHBOARD_STATS } from '@/lib/mock-data';

const PARTNER_COST_PER_JOB = 1350;

export async function GET(request: Request) {
  try {
    await requireRole('ADMIN');

    const { searchParams } = new URL(request.url);
    const demo = searchParams.get('demo') === '1';

    if (demo) {
      return NextResponse.json(DEMO_DASHBOARD_STATS);
    }

    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // --- Totals ---
    const [totalCalls, totalAppointments, totalVisits, totalWorkOrders] = await Promise.all([
      prisma.callRecord.count(),
      prisma.appointment.count(),
      prisma.visit.count(),
      prisma.workOrder.count(),
    ]);

    // --- Period stats helper ---
    async function getPeriodStats(since: Date) {
      const [sales, visits, calls, appointments, workOrdersDone, revenueAgg, activeSellerRows] =
        await Promise.all([
          prisma.dwellingUnit.count({ where: { visitStatus: 'solgt', createdAt: { gte: since } } }),
          prisma.visit.count({ where: { createdAt: { gte: since } } }),
          prisma.callRecord.count({ where: { createdAt: { gte: since } } }),
          prisma.appointment.count({ where: { createdAt: { gte: since } } }),
          prisma.workOrder.count({ where: { status: 'fullfort', completedAt: { gte: since } } }),
          prisma.workOrderUnit.aggregate({
            where: { completedAt: { gte: since } },
            _sum: { price: true },
          }),
          prisma.visit.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: since } },
          }),
        ]);

      const revenue = revenueAgg._sum.price || 0;
      const commission = workOrdersDone * PARTNER_COST_PER_JOB;
      const conversionRate = visits > 0 ? Math.round((sales / visits) * 1000) / 10 : 0;

      return {
        sales,
        visits,
        calls,
        appointments,
        work_orders_done: workOrdersDone,
        revenue,
        commission,
        conversion_rate: conversionRate,
        active_sellers: activeSellerRows.length,
      };
    }

    const [periodToday, periodWeek, periodMonth] = await Promise.all([
      getPeriodStats(todayStart),
      getPeriodStats(weekStart),
      getPeriodStats(monthStart),
    ]);

    // --- Product breakdown (this month) ---
    const productRows = await prisma.workOrderUnit.groupBy({
      by: ['orderType', 'productName'],
      where: { completedAt: { gte: monthStart } },
      _count: { id: true },
      _sum: { price: true },
    });

    const product_breakdown = productRows.map((row) => ({
      product_name: row.productName || row.orderType,
      order_type: row.orderType,
      count: row._count.id,
      revenue: row._sum.price || 0,
      commission: row._count.id * PARTNER_COST_PER_JOB,
    }));

    product_breakdown.sort((a, b) => b.count - a.count);

    // --- Payments ---
    const [pendingPayments, vippsPending, invoicePending, paymentPlans] = await Promise.all([
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
    ]);

    // --- Top sellers (this month) ---
    const sellerVisits = await prisma.visit.findMany({
      where: { createdAt: { gte: monthStart }, unitsSold: { gt: 0 } },
      select: {
        userId: true,
        unitsSold: true,
        totalRevenue: true,
        user: { select: { name: true } },
      },
    });

    const sellerMap = new Map<string, { name: string; sales: number; revenue: number }>();
    for (const v of sellerVisits) {
      const existing = sellerMap.get(v.userId);
      if (existing) {
        existing.sales += v.unitsSold;
        existing.revenue += v.totalRevenue;
      } else {
        sellerMap.set(v.userId, {
          name: v.user.name,
          sales: v.unitsSold,
          revenue: v.totalRevenue,
        });
      }
    }

    const top_sellers = Array.from(sellerMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // --- Upcoming renewals ---
    const upcomingRenewals = await prisma.cleaningHistory.findMany({
      where: { reminderStatus: { in: ['innen_6mnd', 'innen_3mnd', 'forfalt'] } },
      include: { organization: { select: { name: true, address: true } } },
      orderBy: { nextCleaningDate: 'asc' },
    });

    return NextResponse.json({
      revenue_today: periodToday.revenue,
      revenue_week: periodWeek.revenue,
      revenue_month: periodMonth.revenue,
      commission_today: periodToday.commission,
      commission_week: periodWeek.commission,
      commission_month: periodMonth.commission,
      net_today: periodToday.revenue - periodToday.commission,
      net_week: periodWeek.revenue - periodWeek.commission,
      net_month: periodMonth.revenue - periodMonth.commission,
      sales_today: periodToday.sales,
      sales_week: periodWeek.sales,
      sales_month: periodMonth.sales,
      period: {
        today: periodToday,
        week: periodWeek,
        month: periodMonth,
      },
      product_breakdown,
      totals: {
        calls: totalCalls,
        appointments: totalAppointments,
        visits: totalVisits,
        workOrders: totalWorkOrders,
      },
      payments: {
        totalPending: pendingPayments._sum.price || 0,
        vippsPending: vippsPending._sum.price || 0,
        invoicePending: invoicePending._sum.price || 0,
        paymentPlans,
      },
      top_sellers,
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
