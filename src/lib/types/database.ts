export interface ProductBreakdown {
  product_name: string;
  order_type: string;
  count: number;
  revenue: number;
  commission: number;
}

export interface PeriodStats {
  sales: number;
  visits: number;
  calls: number;
  appointments: number;
  work_orders_done: number;
  revenue: number;
  commission: number;
  conversion_rate: number;
  active_sellers: number;
}

export interface SellerPeriodStats {
  sales: number;
  visits: number;
  revenue: number;
  commission: number;
  conversion_rate: number;
}

export interface SellerStats {
  commission_per_unit: number;
  period: {
    today: SellerPeriodStats;
    week: SellerPeriodStats;
    month: SellerPeriodStats;
  };
  product_breakdown: ProductBreakdown[];
}

export interface DashboardStats {
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  commission_today: number;
  commission_week: number;
  commission_month: number;
  net_today: number;
  net_week: number;
  net_month: number;
  sales_today: number;
  sales_week: number;
  sales_month: number;
  period: {
    today: PeriodStats;
    week: PeriodStats;
    month: PeriodStats;
  };
  product_breakdown: ProductBreakdown[];
  totals: {
    calls: number;
    appointments: number;
    visits: number;
    workOrders: number;
  };
  payments: {
    totalPending: number;
    vippsPending: number;
    invoicePending: number;
    paymentPlans: number;
  };
  top_sellers: {
    name: string;
    sales: number;
    revenue: number;
  }[];
  upcomingRenewals: {
    id: string;
    reminderStatus: string;
    nextCleaningDate: string;
    organization: { name: string; address: string };
  }[];
}
