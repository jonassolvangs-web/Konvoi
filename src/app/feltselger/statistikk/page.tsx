'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Eye, TrendingUp, DollarSign } from 'lucide-react';
import StatCard from '@/components/ui/stat-card';
import Card from '@/components/ui/card';
import ToggleTabs from '@/components/ui/toggle-tabs';
import LoadingSpinner from '@/components/ui/loading-spinner';
import ProductBreakdown from '@/components/stats/product-breakdown';
import { formatCurrency } from '@/lib/utils';
import type { SellerStats } from '@/lib/types/database';

const periodTabs = [
  { id: 'today', label: 'I dag' },
  { id: 'week', label: 'Denne uken' },
  { id: 'month', label: 'Denne mnd' },
];

export default function FeltselgerStatistikkPage() {
  const [data, setData] = useState<SellerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    fetch('/api/feltselger/stats')
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
      <h1 className="page-title mb-6">Statistikk</h1>

      {/* Commission summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="!bg-green-50 !border-green-200">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-green-100">
              <DollarSign className="h-5 w-5 text-green-600" strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold text-green-500 uppercase tracking-wider">Provisjon mnd</p>
          </div>
          <p className="text-2xl font-bold text-green-900">{formatCurrency(data.period.month.commission)}</p>
          <p className="text-xs text-green-500 mt-1">
            {data.period.month.sales} salg &times; {formatCurrency(data.commission_per_unit)}
          </p>
        </Card>

        <Card className="!bg-blue-50 !border-blue-200">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-blue-100">
              <TrendingUp className="h-5 w-5 text-blue-600" strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Provisjon uke</p>
          </div>
          <p className="text-2xl font-bold text-blue-900">{formatCurrency(data.period.week.commission)}</p>
          <p className="text-xs text-blue-500 mt-1">
            {data.period.week.sales} salg
          </p>
        </Card>
      </div>

      {/* Period selector */}
      <div className="mb-4">
        <ToggleTabs tabs={periodTabs} activeTab={period} onChange={setPeriod} className="w-full" />
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard icon={ShoppingCart} value={currentPeriod.sales} label="Mine salg" color="bg-blue-50 text-blue-600" />
        <StatCard icon={Eye} value={currentPeriod.visits} label="Besøk" color="bg-green-50 text-green-600" />
        <StatCard icon={TrendingUp} value={`${currentPeriod.conversion_rate}%`} label="Konvertering" color="bg-purple-50 text-purple-600" />
        <StatCard icon={DollarSign} value={formatCurrency(currentPeriod.revenue)} label="Omsetning" color="bg-orange-50 text-orange-600" />
      </div>

      {/* Product breakdown */}
      <div className="mb-4">
        <ProductBreakdown products={data.product_breakdown} />
      </div>

      {/* Period details */}
      <Card>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Periodetall</p>
        <div className="space-y-3">
          {[
            { label: 'Salg', value: currentPeriod.sales },
            { label: 'Besøk', value: currentPeriod.visits },
            { label: 'Omsetning generert', value: formatCurrency(currentPeriod.revenue) },
            { label: 'Provisjon', value: formatCurrency(currentPeriod.commission) },
            { label: 'Konvertering', value: `${currentPeriod.conversion_rate}%` },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-sm font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
