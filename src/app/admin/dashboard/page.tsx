'use client';

import { useEffect, useState } from 'react';
import {
  Phone,
  Calendar,
  ClipboardList,
  Wrench,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Users,
  ShoppingCart,
  Eye,
  BarChart3,
  Trophy,
} from 'lucide-react';
import StatCard from '@/components/ui/stat-card';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import ToggleTabs from '@/components/ui/toggle-tabs';
import LoadingSpinner from '@/components/ui/loading-spinner';
import ProductBreakdown from '@/components/stats/product-breakdown';
import { formatCurrency, formatDateShort, reminderStatusConfig } from '@/lib/utils';
import type { DashboardStats } from '@/lib/types/database';

const periodTabs = [
  { id: 'today', label: 'I dag' },
  { id: 'week', label: 'Denne uken' },
  { id: 'month', label: 'Denne mnd' },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const currentPeriod = data.period[period as keyof typeof data.period];

  return (
    <div className="page-container">
      <h1 className="page-title mb-6">Dashboard</h1>

      {/* Revenue summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Card className="!bg-blue-50 !border-blue-200">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-blue-100">
              <TrendingUp className="h-5 w-5 text-blue-600" strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Omsetning mnd</p>
          </div>
          <p className="text-2xl font-bold text-blue-900">{formatCurrency(data.revenue_month)}</p>
          <p className="text-xs text-blue-500 mt-1">
            Denne uken: {formatCurrency(data.revenue_week)}
          </p>
        </Card>

        <Card className="!bg-orange-50 !border-orange-200">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-orange-100">
              <DollarSign className="h-5 w-5 text-orange-600" strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Provisjon mnd</p>
          </div>
          <p className="text-2xl font-bold text-orange-900">{formatCurrency(data.commission_month)}</p>
          <p className="text-xs text-orange-500 mt-1">
            Denne uken: {formatCurrency(data.commission_week)}
          </p>
        </Card>

        <Card className="!bg-green-50 !border-green-200">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-green-100">
              <BarChart3 className="h-5 w-5 text-green-600" strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold text-green-500 uppercase tracking-wider">Netto mnd</p>
          </div>
          <p className="text-2xl font-bold text-green-900">{formatCurrency(data.net_month)}</p>
          <p className="text-xs text-green-500 mt-1">
            Denne uken: {formatCurrency(data.net_week)}
          </p>
        </Card>
      </div>

      {/* Period selector */}
      <div className="mb-4">
        <ToggleTabs tabs={periodTabs} activeTab={period} onChange={setPeriod} className="w-full" />
      </div>

      {/* Key stats grid for selected period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={ShoppingCart} value={currentPeriod.sales} label="Salg" color="bg-blue-50 text-blue-600" />
        <StatCard icon={Eye} value={currentPeriod.visits} label="Besøk" color="bg-green-50 text-green-600" />
        <StatCard icon={Phone} value={currentPeriod.calls} label="Samtaler" color="bg-purple-50 text-purple-600" />
        <StatCard icon={Users} value={currentPeriod.active_sellers} label="Aktive selgere" color="bg-cyan-50 text-cyan-600" />
      </div>

      {/* Conversion + revenue for period */}
      <Card className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Periodetall</p>
        <div className="space-y-3">
          {[
            { label: 'Omsetning', value: formatCurrency(currentPeriod.revenue) },
            { label: 'Provisjon', value: formatCurrency(currentPeriod.commission) },
            { label: 'Møter booket', value: currentPeriod.appointments },
            { label: 'Oppdrag fullført', value: currentPeriod.work_orders_done },
            { label: 'Konvertering', value: `${currentPeriod.conversion_rate}%` },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-sm font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Product breakdown */}
      <div className="mb-4">
        <ProductBreakdown products={data.product_breakdown} />
      </div>

      {/* Top sellers */}
      {data.top_sellers && data.top_sellers.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Topp selgere denne mnd</p>
          </div>
          <div className="space-y-3">
            {data.top_sellers.map((seller, i) => (
              <div key={seller.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-5">{i + 1}.</span>
                  <span className="text-sm font-medium">{seller.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{seller.sales} salg</span>
                  <span className="text-xs text-gray-400 ml-2">{formatCurrency(seller.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Totals */}
      <Card className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Totalt alle tider</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Phone} value={data.totals.calls} label="Samtaler" color="bg-blue-50 text-blue-600" />
          <StatCard icon={Calendar} value={data.totals.appointments} label="Møter" color="bg-purple-50 text-purple-600" />
          <StatCard icon={ClipboardList} value={data.totals.visits} label="Besøk" color="bg-green-50 text-green-600" />
          <StatCard icon={Wrench} value={data.totals.workOrders} label="Oppdrag" color="bg-orange-50 text-orange-600" />
        </div>
      </Card>

      {/* Payments */}
      <Card className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Betalinger</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Totalt utestående</span>
            <span className="text-sm font-semibold text-red-600">{formatCurrency(data.payments.totalPending)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Venter Vipps</span>
            <span className="text-sm font-semibold">{formatCurrency(data.payments.vippsPending)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Venter faktura</span>
            <span className="text-sm font-semibold">{formatCurrency(data.payments.invoicePending)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Betalingsplaner</span>
            <span className="text-sm font-semibold">{data.payments.paymentPlans}</span>
          </div>
        </div>
      </Card>

      {/* Upcoming renewals */}
      {data.upcomingRenewals.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kommende fornyelser</p>
          </div>
          <div className="space-y-3">
            {data.upcomingRenewals.map((renewal) => (
              <div key={renewal.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{renewal.organization.name}</p>
                  <p className="text-xs text-gray-500">Neste rens: {formatDateShort(renewal.nextCleaningDate)}</p>
                </div>
                <Badge color={reminderStatusConfig[renewal.reminderStatus]?.color}>
                  {reminderStatusConfig[renewal.reminderStatus]?.label}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
