'use client';

import { useState, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
}

type Range = '5yr' | '10yr' | 'all';

export function HostedRentHistory({ snapshot }: Props) {
  const [range, setRange] = useState<Range>('5yr');
  const raw = snapshot.rent_history;

  const data = useMemo(() => {
    if (!raw || !Array.isArray(raw) || raw.length === 0) return [];

    const now = new Date();
    const cutoff = range === '5yr'
      ? new Date(now.getFullYear() - 5, now.getMonth(), 1)
      : range === '10yr'
      ? new Date(now.getFullYear() - 10, now.getMonth(), 1)
      : new Date(0);

    return raw
      .filter((r) => new Date(r.time_frame as string) >= cutoff)
      .map((r) => ({
        period: new Date(r.time_frame as string).toLocaleDateString('en-NZ', { month: 'short', year: '2-digit' }),
        median: r.median_rent as number,
        lq: r.lower_quartile_rent as number | null,
        uq: r.upper_quartile_rent as number | null,
      }));
  }, [raw, range]);

  if (data.length < 3) return null;

  const latestMedian = data[data.length - 1]?.median;
  const earliestMedian = data[0]?.median;
  const cagr = earliestMedian && latestMedian && data.length > 1
    ? ((latestMedian / earliestMedian) ** (1 / (data.length / 12)) - 1) * 100
    : null;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">Rent History</h3>
        <div className="flex gap-1">
          {(['5yr', '10yr', 'all'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-piq-primary text-white'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 pb-5">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="rentMedianFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0D7377" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#0D7377" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94A3B8' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => `$${v}`} width={50} />
            <Tooltip
              formatter={(value: number) => [`$${value}/wk`, 'Median rent']}
              labelStyle={{ fontSize: 11, color: '#64748B' }}
              contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="median"
              stroke="#0D7377"
              fill="url(#rentMedianFill)"
              strokeWidth={2}
              dot={false}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Area-level rent data from MBIE bond lodgements</span>
          {cagr !== null && (
            <span className={cagr >= 0 ? 'text-piq-accent-warm' : 'text-piq-success'}>
              CAGR: {cagr >= 0 ? '+' : ''}{cagr.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
