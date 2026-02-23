'use client';

import { useEffect, useState } from 'react';
import { Phone, Calendar, ClipboardList, Wrench, AlertTriangle } from 'lucide-react';
import StatCard from '@/components/ui/stat-card';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { formatCurrency, formatDateShort, reminderStatusConfig } from '@/lib/utils';

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  return (
    <div className="page-container">
      <h1 className="page-title mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Phone} value={data.totals.calls} label="Samtaler" color="bg-blue-50 text-blue-600" />
        <StatCard icon={Calendar} value={data.totals.appointments} label="Møter" color="bg-purple-50 text-purple-600" />
        <StatCard icon={ClipboardList} value={data.totals.visits} label="Besøk" color="bg-green-50 text-green-600" />
        <StatCard icon={Wrench} value={data.totals.workOrders} label="Oppdrag" color="bg-orange-50 text-orange-600" />
      </div>

      <Card className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Denne uken</p>
        <div className="space-y-3">
          {[
            { label: 'Ringt', value: data.thisWeek.calls },
            { label: 'Møter booket', value: data.thisWeek.appointments },
            { label: 'Enheter solgt', value: data.thisWeek.unitsSold },
            { label: 'Oppdrag fullført', value: data.thisWeek.workOrdersDone },
            { label: 'Omsetning', value: formatCurrency(data.thisWeek.revenue) },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-sm font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Betalinger</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Totalt utestende</span>
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

      {data.upcomingRenewals.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kommende fornyelser</p>
          </div>
          <div className="space-y-3">
            {data.upcomingRenewals.map((renewal: any) => (
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
