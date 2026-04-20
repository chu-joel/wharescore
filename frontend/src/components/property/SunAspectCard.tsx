'use client';

import { Sun, Snowflake } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface Props {
  report: PropertyReport;
}

const ASPECT_INFO: Record<string, { sun: string; warmth: string; variant: 'good' | 'ok' | 'poor' }> = {
  'N':  { sun: 'Maximum sun all day', warmth: 'Warm in winter. best orientation in NZ', variant: 'good' },
  'NE': { sun: 'Morning sun, good all-day light', warmth: 'Warm mornings, good winter sun', variant: 'good' },
  'NW': { sun: 'Afternoon sun, good all-day light', warmth: 'Warm afternoons, good winter sun', variant: 'good' },
  'E':  { sun: 'Morning sun only', warmth: 'Bright mornings, cooler afternoons', variant: 'ok' },
  'W':  { sun: 'Afternoon sun only', warmth: 'Cool mornings, warm afternoons', variant: 'ok' },
  'SE': { sun: 'Limited. morning only, less in winter', warmth: 'May be cool in winter', variant: 'poor' },
  'SW': { sun: 'Limited. afternoon only, less in winter', warmth: 'May be cool in winter', variant: 'poor' },
  'S':  { sun: 'Very limited winter sun', warmth: 'Coldest orientation. expect higher heating costs', variant: 'poor' },
};

const VARIANT_STYLES = {
  good: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200/60 dark:border-amber-900/40', icon: 'text-amber-500' },
  ok: { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200/60 dark:border-blue-900/40', icon: 'text-blue-500' },
  poor: { bg: 'bg-slate-50 dark:bg-slate-950/20', border: 'border-slate-200/60 dark:border-slate-900/40', icon: 'text-slate-500' },
};

export function SunAspectCard({ report }: Props) {
  const aspect = report.terrain?.aspect_label;
  if (!aspect) return null;

  const info = ASPECT_INFO[aspect];
  if (!info) return null;

  const style = VARIANT_STYLES[info.variant];
  const Icon = info.variant === 'poor' ? Snowflake : Sun;

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-3.5`}>
      <div className="flex items-center gap-2.5">
        <Icon className={`h-5 w-5 ${style.icon} shrink-0`} />
        <div>
          <p className="text-sm font-semibold">
            {aspect}-facing property
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {info.sun}. {info.warmth}.
          </p>
        </div>
      </div>
    </div>
  );
}
