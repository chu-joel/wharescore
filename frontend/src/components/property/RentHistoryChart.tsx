'use client';

import { useState } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { CHART_THEME } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

interface RentHistoryPoint {
  period: string;
  median: number;
  lower_quartile: number;
  upper_quartile: number;
  bond_count: number;
}

interface RentHistoryResponse {
  data: RentHistoryPoint[];
  cagr: { yr1: number | null; yr5: number | null; yr10: number | null };
}

interface RentHistoryChartProps {
  addressId: number;
}

const RANGE_OPTIONS = [
  { value: '5', label: '5yr' },
  { value: '10', label: '10yr' },
  { value: 'all', label: 'All' },
] as const;

export function RentHistoryChart({ addressId }: RentHistoryChartProps) {
  const [range, setRange] = useState<string>('10');

  const { data, isLoading } = useQuery({
    queryKey: ['rent-history', addressId, range],
    queryFn: () =>
      apiFetch<RentHistoryResponse>(
        `/api/v1/property/${addressId}/rent-history?range=${range}`
      ),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <Skeleton className="h-60 w-full rounded-lg" />;
  }

  // Hide when the endpoint returns no rows OR when every row has a zero /
  // missing median — both cases render an empty chart that adds no value.
  if (!data || data.data.length === 0) return null;
  const hasAnyMedian = data.data.some((p) => p.median && p.median > 0);
  if (!hasAnyMedian) return null;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">Rent History</span>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`rounded-full h-7 px-3 text-xs font-medium border transition-colors ${
                range === opt.value
                  ? 'bg-piq-primary text-white border-piq-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data.data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="rentBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_THEME.colors.primaryLight} stopOpacity={0.5} />
              <stop offset="100%" stopColor={CHART_THEME.colors.primaryLight} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" opacity={0.5} vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}`}
            width={50}
          />
          <Tooltip
            contentStyle={CHART_THEME.tooltip.contentStyle}
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === 'median' ? 'Median' : name === 'upper_quartile' ? 'Upper Q' : 'Lower Q',
            ]}
            labelFormatter={(label) => label}
          />
          <Area
            type="monotone"
            dataKey="upper_quartile"
            stroke="none"
            fill="url(#rentBand)"
          />
          <Area
            type="monotone"
            dataKey="lower_quartile"
            stroke="none"
            fill="white"
          />
          <ReferenceLine
            y={data.data[data.data.length - 1]?.median}
            stroke={CHART_THEME.colors.primary}
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="median"
            stroke={CHART_THEME.colors.primary}
            strokeWidth={2}
            dot={false}
            animationDuration={1200}
            activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_THEME.colors.primary, fill: 'white' }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground mt-1">
        SA2-level rent data from MBIE bond lodgements
      </p>
    </div>
  );
}
