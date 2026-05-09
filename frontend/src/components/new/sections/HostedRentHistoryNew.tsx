'use client';

import { useState, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

type Range = '5yr' | '10yr' | 'all';

export function HostedRentHistoryNew({ snapshot }: { snapshot: ReportSnapshot }) {
  const [range, setRange] = useState<Range>('5yr');
  const raw = snapshot.rent_history;

  const data = useMemo(() => {
    if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
    const now = new Date();
    const cutoff = range === '5yr' ? new Date(now.getFullYear() - 5, now.getMonth(), 1)
                 : range === '10yr' ? new Date(now.getFullYear() - 10, now.getMonth(), 1)
                 : new Date(0);
    return raw
      .filter((r) => new Date(r.time_frame as string) >= cutoff)
      .map((r) => ({
        period: new Date(r.time_frame as string).toLocaleDateString('en-NZ', { month: 'short', year: '2-digit' }),
        median: r.median_rent as number,
      }));
  }, [raw, range]);

  if (data.length < 3) return null;

  const latest = data[data.length - 1]?.median;
  const earliest = data[0]?.median;
  const cagr = earliest && latest && data.length > 1
    ? ((latest / earliest) ** (1 / (data.length / 12)) - 1) * 100
    : null;

  return (
    <Card>
      <CardHead
        title="Rent history"
        meta={cagr != null ? `CAGR ${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}%` : 'MBIE bond data'}
      />
      <div className="ws-card-body">
        <div className="ws-pill-toggle" role="group" aria-label="Time range" style={{ marginBottom: 10 }}>
          {(['5yr', '10yr', 'all'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={range === r ? 'active' : ''}
              style={{ minHeight: 32, padding: '0 12px', fontSize: 12 }}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="rentMedianFillNew" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0D7377" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#0D7377" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,.18)" />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'currentColor' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} tickFormatter={(v) => `$${v}`} width={50} />
            <Tooltip
              formatter={(value: unknown) => [`$${value}/wk`, 'Median rent']}
              labelStyle={{ fontSize: 11 }}
              contentStyle={{ borderRadius: 8, border: '1px solid var(--ws-rule)', fontSize: 12, background: 'var(--ws-surface)' }}
            />
            <Area
              type="monotone"
              dataKey="median"
              stroke="#0D7377"
              fill="url(#rentMedianFillNew)"
              strokeWidth={2.25}
              dot={false}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          Area-level rent data from MBIE bond lodgements.
        </p>
      </div>
    </Card>
  );
}
