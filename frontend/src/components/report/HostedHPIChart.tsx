'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from 'recharts';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
}

export function HostedHPIChart({ snapshot }: Props) {
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
    for (const pt of mapped) {
      if (!peakPoint || pt.hpi > peakPoint.hpi) peakPoint = pt;
    }

    return { data: mapped, peak: peakPoint };
  }, [raw]);

  if (data.length < 3) return null;

  const latest = data[data.length - 1]?.hpi;
  const fromPeak = peak && latest ? ((latest / peak.hpi - 1) * 100).toFixed(1) : null;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">NZ House Price Index</h3>
        {fromPeak !== null && (
          <span className="text-xs text-muted-foreground">
            {Number(fromPeak) < 0 ? fromPeak : `+${fromPeak}`}% from peak
          </span>
        )}
      </div>
      <div className="px-5 pb-5">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="hpiFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0D7377" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#0D7377" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94A3B8' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} width={45} domain={['dataMin - 100', 'dataMax + 50']} />
            <Tooltip
              formatter={(value: unknown) => [Number(value).toFixed(0), 'HPI']}
              labelStyle={{ fontSize: 11, color: '#64748B' }}
              contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="hpi"
              stroke="#0D7377"
              fill="url(#hpiFill)"
              strokeWidth={2}
              dot={false}
              animationDuration={800}
            />
            {peak && (
              <ReferenceDot x={peak.period} y={peak.hpi} r={4} fill="#D97706" stroke="white" strokeWidth={2} />
            )}
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-2">Source: RBNZ. National index. not property-specific.</p>
      </div>
    </div>
  );
}
