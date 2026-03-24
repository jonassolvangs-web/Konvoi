import type { DashboardStats, ProductBreakdown, PeriodStats } from '@/lib/types/database';

export const DEMO_PRODUCT_BREAKDOWN: ProductBreakdown[] = [
  { product_name: 'Standard', order_type: 'ventilasjonsrens', count: 34, revenue: 135660, commission: 45900 },
  { product_name: 'Medium', order_type: 'ventilasjonsrens', count: 22, revenue: 109780, commission: 29700 },
  { product_name: 'Stor', order_type: 'ventilasjonsrens', count: 11, revenue: 65890, commission: 14850 },
  { product_name: 'Service Standard', order_type: 'service', count: 8, revenue: 15920, commission: 10800 },
  { product_name: 'Filterbytte', order_type: 'service', count: 5, revenue: 4950, commission: 6750 },
  { product_name: 'Service Pluss', order_type: 'service', count: 3, revenue: 8970, commission: 4050 },
];

const DEMO_PERIOD_TODAY: PeriodStats = {
  sales: 4,
  visits: 6,
  calls: 18,
  appointments: 3,
  work_orders_done: 2,
  revenue: 17960,
  commission: 5400,
  conversion_rate: 66.7,
  active_sellers: 3,
};

const DEMO_PERIOD_WEEK: PeriodStats = {
  sales: 19,
  visits: 28,
  calls: 87,
  appointments: 14,
  work_orders_done: 12,
  revenue: 82450,
  commission: 25650,
  conversion_rate: 67.9,
  active_sellers: 5,
};

const DEMO_PERIOD_MONTH: PeriodStats = {
  sales: 83,
  visits: 112,
  calls: 342,
  appointments: 56,
  work_orders_done: 48,
  revenue: 341170,
  commission: 112050,
  conversion_rate: 74.1,
  active_sellers: 7,
};

export const DEMO_DASHBOARD_STATS: DashboardStats = {
  revenue_today: 17960,
  revenue_week: 82450,
  revenue_month: 341170,
  commission_today: 5400,
  commission_week: 25650,
  commission_month: 112050,
  net_today: 12560,
  net_week: 56800,
  net_month: 229120,
  sales_today: 4,
  sales_week: 19,
  sales_month: 83,
  period: {
    today: DEMO_PERIOD_TODAY,
    week: DEMO_PERIOD_WEEK,
    month: DEMO_PERIOD_MONTH,
  },
  product_breakdown: DEMO_PRODUCT_BREAKDOWN,
  totals: {
    calls: 1247,
    appointments: 312,
    visits: 489,
    workOrders: 198,
  },
  payments: {
    totalPending: 89400,
    vippsPending: 43200,
    invoicePending: 46200,
    paymentPlans: 12,
  },
  top_sellers: [
    { name: 'Jonas Eriksen', sales: 28, revenue: 124320 },
    { name: 'Maria Hansen', sales: 22, revenue: 98780 },
    { name: 'Lars Olsen', sales: 18, revenue: 79820 },
    { name: 'Kari Nordmann', sales: 15, revenue: 64250 },
  ],
  upcomingRenewals: [
    {
      id: 'demo-1',
      reminderStatus: 'innen_3mnd',
      nextCleaningDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      organization: { name: 'Bjørkelia Sameie', address: 'Bjørkeveien 12, 0580 Oslo' },
    },
    {
      id: 'demo-2',
      reminderStatus: 'forfalt',
      nextCleaningDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      organization: { name: 'Grantoppen BRL', address: 'Granveien 45, 1356 Bekkestua' },
    },
    {
      id: 'demo-3',
      reminderStatus: 'innen_6mnd',
      nextCleaningDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
      organization: { name: 'Solbakken Terrasse', address: 'Solveien 8, 0283 Oslo' },
    },
  ],
};
