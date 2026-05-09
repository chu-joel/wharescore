'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from 'recharts';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

export function HostedHPIChartNew({ snapshot }: { snapshot: ReportSnapshot }) {
  const raw = snapshot.hpi_data;
  const { data, peak } = useMemo(() => {
    if (!raw || !Array.isArray(raw) || raw.length === 0) return { data: [], peak: null };
    const mapped = raw.map((r) => {
      const d = new Date(r.quarter_end as string);
      return {
        period: d.toLocaleDateString('en-NZ', { month: 'short', year: '2-digit' }),
        hpi: r.house_price_index as number,
      };
    });
    let peakPoint: { period: string; hpi: number } | null = null;
    for (const pt of mapped) if (!peakPoint || pt.hpi > peakPoint.hpi) peakPoint = pt;
    return { data: mapped, peak: peakPoint };
  }, [raw]);

  if (data.length < 3) return null;

  const latest = data[data.length - 1]?.hpi;
  const fromPeakRaw = peak && latest ? ((latest / peak.hpi - 1) * 100) : null;
  const fromPeak = fromPeakRaw != null ? fromPeakRaw.toFixed(1) : null;

  return (
    <Card>
      <CardHead
        title="NZ house price index"
        meta={fromPeak != null ? `${Number(fromPeak) < 0 ? fromPeak : `+${fromPeak}`}% from peak` : 'RBNZ'}
      />
      <div className="ws-card-body">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="hpiFillNew" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0D7377" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#0D7377" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,.18)" />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'currentColor' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} width={45} domain={['dataMin - 100', 'dataMax + 50']} />
            <Tooltip
              formatter={(value: unknown) => [Number(value).toFixed(0), 'HPI']}
              labelStyle={{ fontSize: 11 }}
              contentStyle={{ borderRadius: 8, border: '1px solid var(--ws-rule)', fontSize: 12, background: 'var(--ws-surface)' }}
            />
            <Area
              type="monotone"
              dataKey="hpi"
              stroke="#0D7377"
              fill="url(#hpiFillNew)"
              strokeWidth={2.25}
              dot={false}
              animationDuration={800}
            />
            {peak && (
              <ReferenceDot x={peak.period} y={peak.hpi} r={4} fill="var(--ws-warm)" stroke="var(--ws-surface)" strokeWidth={2} />
            )}
          </AreaChart>
        </ResponsiveContainer>
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          Source: RBNZ. National index, not property-specific.
        </p>
      </div>
    </Card>
  );
}
