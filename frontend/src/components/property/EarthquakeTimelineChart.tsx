'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
  ZAxis,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { CHART_THEME } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

interface EqPoint {
  year: number;
  count: number;
  max_mag: number;
}

interface EarthquakeTimelineChartProps {
  addressId: number;
}

export function EarthquakeTimelineChart({ addressId }: EarthquakeTimelineChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['earthquake-timeline', addressId],
    queryFn: () => apiFetch<EqPoint[]>(`/api/v1/property/${addressId}/earthquake-timeline`),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) return <Skeleton className="h-52 w-full rounded-xl" />;
  if (!data || data.length === 0) return null;

  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const maxMag = Math.max(...data.map((d) => d.max_mag));

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated space-y-3">
      <div>
        <p className="text-sm font-bold">Earthquake Activity (50km radius)</p>
        <p className="text-xs text-muted-foreground">
          {totalCount.toLocaleString()} events in {data.length} years · Max M{maxMag.toFixed(1)}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="year"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 10, fill: '#6B7280' }}
            tickFormatter={(v: number) => String(v)}
          />
          <YAxis
            dataKey="max_mag"
            name="Max Magnitude"
            tick={{ fontSize: 10, fill: '#6B7280' }}
            width={30}
            domain={[0, 'auto']}
          />
          <ZAxis dataKey="count" range={[40, 400]} />
          <ReferenceLine
            y={5.0}
            stroke="#EF4444"
            strokeDasharray="4 4"
            label={{ value: 'M5.0', position: 'right', fontSize: 10, fill: '#EF4444' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as EqPoint;
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm">
                  <p className="font-semibold">{d.year}</p>
                  <p>{d.count} earthquakes</p>
                  <p>Max magnitude: M{d.max_mag.toFixed(1)}</p>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            fill={CHART_THEME.colors.primary}
            fillOpacity={0.6}
            animationDuration={800}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
