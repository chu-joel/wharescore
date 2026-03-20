'use client';

import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { TrendIndicator } from '@/components/common/TrendIndicator';
import { apiFetch } from '@/lib/api';

interface CrimeTrendPoint {
  month: string;
  count: number;
}

interface CrimeTrendSparklineProps {
  addressId: number;
}

export function CrimeTrendSparkline({ addressId }: CrimeTrendSparklineProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['crime-trend', addressId],
    queryFn: () => apiFetch<CrimeTrendPoint[]>(`/api/v1/property/${addressId}/crime-trend`),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  // Don't show anything while loading or on error — this is a supplementary widget
  if (isLoading || isError) return null;
  if (!data || !Array.isArray(data) || data.length < 3) return null;

  // Calculate trend direction
  const recentAvg = data.slice(-6).reduce((s, d) => s + d.count, 0) / Math.min(6, data.length);
  const olderAvg = data.slice(0, 6).reduce((s, d) => s + d.count, 0) / Math.min(6, data.length);
  const changePct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  const direction = changePct < -10 ? 'improving' as const : changePct > 10 ? 'worsening' as const : 'stable' as const;
  const label = Math.abs(changePct) >= 10
    ? `Crime ${direction === 'improving' ? 'down' : 'up'} ${Math.abs(Math.round(changePct))}% over ${Math.round(data.length / 12)} years`
    : 'Crime rates stable';

  return (
    <div className="rounded-lg border border-border bg-card p-3 card-elevated">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Crime Trend</span>
        <TrendIndicator direction={direction} label={label} />
      </div>
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="crimeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D7377" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#0D7377" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="count"
            stroke="#0D7377"
            fill="url(#crimeFill)"
            strokeWidth={1.5}
            dot={false}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
