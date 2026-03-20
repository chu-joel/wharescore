'use client';

import { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { CHART_THEME } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendIndicator } from '@/components/common/TrendIndicator';

interface CrimeTrendPoint {
  month: string;
  count: number;
}

interface CrimeTrendChartProps {
  addressId: number;
}

const RANGE_OPTIONS = [
  { value: 12, label: '1yr' },
  { value: 24, label: '2yr' },
  { value: 36, label: '3yr' },
] as const;

function computeRollingAvg(data: CrimeTrendPoint[], window: number = 6): (CrimeTrendPoint & { avg: number })[] {
  return data.map((d, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((s, p) => s + p.count, 0) / slice.length;
    return { ...d, avg: Math.round(avg * 10) / 10 };
  });
}

export function CrimeTrendChart({ addressId }: CrimeTrendChartProps) {
  const [months, setMonths] = useState(24);

  const { data, isLoading } = useQuery({
    queryKey: ['crime-trend', addressId],
    queryFn: () => apiFetch<CrimeTrendPoint[]>(`/api/v1/property/${addressId}/crime-trend`),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!data || data.length < 3) return null;

  const sliced = data.slice(-months);
  const chartData = computeRollingAvg(sliced);

  // Trend calculation
  const recentAvg = sliced.slice(-6).reduce((s, d) => s + d.count, 0) / Math.min(6, sliced.length);
  const olderAvg = sliced.slice(0, 6).reduce((s, d) => s + d.count, 0) / Math.min(6, sliced.length);
  const changePct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  const direction = changePct < -10 ? 'improving' as const : changePct > 10 ? 'worsening' as const : 'stable' as const;

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">Crime Trend</p>
          <p className="text-xs text-muted-foreground">Monthly victimisations in this area</p>
        </div>
        <TrendIndicator direction={direction} />
      </div>

      {/* Range selector */}
      <div className="flex gap-1">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMonths(opt.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              months === opt.value
                ? 'bg-piq-primary text-white'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: '#6B7280' }}
            tickFormatter={(v: string) => {
              const [y, m] = v.split('-');
              return `${m}/${y.slice(2)}`;
            }}
            interval={Math.max(1, Math.floor(chartData.length / 8))}
          />
          <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} width={35} />
          <Tooltip
            {...CHART_THEME.tooltip}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as CrimeTrendPoint & { avg: number };
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm">
                  <p className="font-semibold">{d.month}</p>
                  <p>Count: {d.count}</p>
                  <p className="text-muted-foreground">6m avg: {d.avg}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill={CHART_THEME.colors.primaryLight} radius={[2, 2, 0, 0]} />
          <Line
            type="monotone"
            dataKey="avg"
            stroke={CHART_THEME.colors.primary}
            strokeWidth={2}
            dot={false}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
