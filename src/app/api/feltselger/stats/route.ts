import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { SETTING_KEYS } from '@/lib/constants';

export async function GET() {
  try {
    const session = await requireRole('FELTSELGER');
    const userId = (session.user as any).id;

    // Get commission setting
    const commissionSetting = await prisma.setting.findUnique({
      where: { key: SETTING_KEYS.SELLER_COMMISSION_PER_UNIT },
    });
    const commissionPerUnit = commissionSetting ? parseFloat(commissionSetting.value) || 0 : 0;

    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    async function getSellerPeriodStats(since: Date) {
      const [sales, visits, revenueAgg] = await Promise.all([
        prisma.dwellingUnit.count({
          where: {
            visitStatus: 'solgt',
            createdAt: { gte: since },
            visit: { userId },
          },
        }),
        prisma.visit.count({
          where: { userId, createdAt: { gte: since } },
        }),
        prisma.dwellingUnit.aggregate({
          where: {
            visitStatus: 'solgt',
            createdAt: { gte: since },
            visit: { userId },
          },
          _sum: { price: true },
        }),
      ]);

      const revenue = revenueAgg._sum.price || 0;
      const commission = sales * commissionPerUnit;
      const conversionRate = visits > 0 ? Math.round((sales / visits) * 1000) / 10 : 0;

      return { sales, visits, revenue, commission, conversion_rate: conversionRate };
    }

    // Period stats + product breakdown in parallel
    const [periodToday, periodWeek, periodMonth, productRows] = await Promise.all([
      getSellerPeriodStats(todayStart),
      getSellerPeriodStats(weekStart),
      getSellerPeriodStats(monthStart),
      prisma.dwellingUnit.groupBy({
        by: ['orderType', 'product'],
        where: {
          visitStatus: 'solgt',
          createdAt: { gte: monthStart },
          visit: { userId },
        },
        _count: { id: true },
        _sum: { price: true },
      }),
    ]);

    const product_breakdown = productRows.map((row) => ({
      product_name: row.product || row.orderType || 'Ukjent',
      order_type: row.orderType || 'ukjent',
      count: row._count.id,
      revenue: row._sum.price || 0,
      commission: row._count.id * commissionPerUnit,
    }));

    product_breakdown.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      commission_per_unit: commissionPerUnit,
      period: {
        today: periodToday,
        week: periodWeek,
        month: periodMonth,
      },
      product_breakdown,
    });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }
    if (error.message === 'Ingen tilgang') {
      return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    }
    console.error('Feltselger stats error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
