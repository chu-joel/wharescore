'use client';

import { Volume2 } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
}

export function HostedRoadNoise({ snapshot }: Props) {
  const noise = (snapshot as Record<string, unknown>).road_noise as { laeq24h: number } | null | undefined;

  if (!noise?.laeq24h) return null;

  const db = noise.laeq24h;

  // Categorise noise level
  let level: string;
  let color: string;
  let description: string;

  if (db >= 70) {
    level = 'Very High';
    color = 'text-risk-high';
    description = 'Significant road noise — may affect sleep and outdoor enjoyment. Consider double glazing.';
  } else if (db >= 65) {
    level = 'High';
    color = 'text-amber-600';
    description = 'Noticeable road noise — conversation outdoors may be difficult at peak times.';
  } else if (db >= 60) {
    level = 'Moderate';
    color = 'text-yellow-600';
    description = 'Moderate traffic noise — generally manageable but noticeable with windows open.';
  } else if (db >= 55) {
    level = 'Low–Moderate';
    color = 'text-piq-success';
    description = 'Some background traffic noise — typical for suburban streets near main roads.';
  } else {
    level = 'Low';
    color = 'text-piq-success';
    description = 'Minimal road noise impact at this location.';
  }

  return (
    <div className={`rounded-lg border p-4 ${db >= 65 ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10' : 'border-border bg-muted/30'}`}>
      <div className="flex items-start gap-3">
        <Volume2 className={`h-5 w-5 shrink-0 mt-0.5 ${color}`} />
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <h4 className="text-sm font-semibold">Road Traffic Noise</h4>
            <span className={`text-xs font-bold ${color}`}>{level}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-2xl font-bold tabular-nums">{db}</span>
            <span className="text-xs text-muted-foreground">dB LAeq(24h)</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{description}</p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Source: Waka Kotahi / NZTA national road noise contours (state highways & arterials).
          </p>
        </div>
      </div>
    </div>
  );
}
