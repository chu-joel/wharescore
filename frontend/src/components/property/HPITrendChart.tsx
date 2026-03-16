'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
} from 'recharts';
import { CHART_THEME } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

interface HPIPoint {
  period: string;
  hpi: number;
}

interface HPIResponse {
  data: HPIPoint[];
  peak: { period: string; hpi: number } | null;
}

export function HPITrendChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['hpi-trend'],
    queryFn: () => apiFetch<HPIResponse>('/api/v1/market/hpi'),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return <Skeleton className="h-52 w-full rounded-lg" />;
  }

  if (!data || data.data.length === 0) return null;

  return (
    <div className="rounded-lg border border-border p-3">
      <span className="text-sm font-semibold">NZ House Price Index</span>
      <p className="text-[10px] text-muted-foreground mb-2">
        National quarterly index (RBNZ / CoreLogic)
      </p>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data.data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="hpiFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_THEME.colors.primary} stopOpacity={0.3} />
              <stop offset="100%" stopColor={CHART_THEME.colors.primary} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip
            contentStyle={CHART_THEME.tooltip.contentStyle}
            formatter={(value) => [Number(value).toFixed(1), 'HPI']}
          />
          <Area
            type="monotone"
            dataKey="hpi"
            stroke={CHART_THEME.colors.primary}
            strokeWidth={2}
            fill="url(#hpiFill)"
            animationDuration={1200}
          />
          {data.peak && (
            <>
              <ReferenceDot
                x={data.peak.period}
                y={data.peak.hpi}
                r={8}
                fill="none"
                stroke={CHART_THEME.colors.primary}
                strokeOpacity={0.3}
                strokeWidth={1}
              />
              <ReferenceDot
                x={data.peak.period}
                y={data.peak.hpi}
                r={5}
                fill={CHART_THEME.colors.primary}
                stroke={CHART_THEME.colors.primary}
                strokeWidth={2}
              />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>

      {data.peak && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Peak: {data.peak.period} ({data.peak.hpi.toFixed(1)})
        </p>
      )}
    </div>
  );
}
