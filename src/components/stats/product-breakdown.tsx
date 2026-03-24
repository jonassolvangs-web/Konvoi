'use client';

import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { ProductBreakdown as ProductBreakdownType } from '@/lib/types/database';

interface ProductBreakdownProps {
  products: ProductBreakdownType[];
}

const orderTypeLabels: Record<string, { label: string; color: string }> = {
  ventilasjonsrens: { label: 'Rens', color: 'bg-blue-100 text-blue-700' },
  service: { label: 'Service', color: 'bg-green-100 text-green-700' },
};

export default function ProductBreakdown({ products }: ProductBreakdownProps) {
  if (!products || products.length === 0) return null;

  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Salg per produkt</p>
        <p className="text-xs text-gray-400">Denne måneden</p>
      </div>

      <div className="space-y-3">
        {products.map((product) => {
          const pct = totalRevenue > 0 ? Math.round((product.revenue / totalRevenue) * 100) : 0;
          const typeConfig = orderTypeLabels[product.order_type] || { label: product.order_type, color: 'bg-gray-100 text-gray-700' };

          return (
            <div key={`${product.order_type}-${product.product_name}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{product.product_name}</span>
                  <Badge color={typeConfig.color}>{typeConfig.label}</Badge>
                </div>
                <span className="text-sm font-semibold">{product.count} solgt</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-24 text-right">{formatCurrency(product.revenue)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Totalt</span>
        <span className="text-sm font-bold">{formatCurrency(totalRevenue)}</span>
      </div>
    </Card>
  );
}
