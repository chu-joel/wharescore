'use client';

import { Sun } from 'lucide-react';

interface SolarPotentialCardProps {
  meanKwh: number | null;
  maxKwh: number | null;
}

export function SolarPotentialCard({ meanKwh, maxKwh }: SolarPotentialCardProps) {
  if (meanKwh == null && maxKwh == null) return null;

  const displayMean = meanKwh != null ? Math.round(meanKwh) : null;
  const displayMax = maxKwh != null ? Math.round(maxKwh) : null;

  // Calculate fill percentage (mean relative to max)
  const fillPct =
    displayMean != null && displayMax != null && displayMax > 0
      ? Math.min(100, Math.round((displayMean / displayMax) * 100))
      : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <Sun className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <span className="text-sm font-bold">Solar Potential</span>
      </div>

      {displayMean != null && (
        <div className="mb-1">
          <span className="text-2xl font-bold tracking-tight">
            {displayMean.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground ml-1.5">kWh/year avg</span>
        </div>
      )}

      {displayMax != null && (
        <p className="text-xs text-muted-foreground mb-3">
          Up to {displayMax.toLocaleString()} kWh/year peak
        </p>
      )}

      {fillPct != null && (
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500"
            style={{ width: `${fillPct}%` }}
          />
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Based on rooftop solar irradiance data
      </p>
    </div>
  );
}
