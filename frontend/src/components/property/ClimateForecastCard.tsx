'use client';

import { Thermometer, CloudRain, ArrowUp, ArrowDown } from 'lucide-react';

interface ClimateForecastCardProps {
  projection: Record<string, unknown> | null;
}

export function ClimateForecastCard({ projection }: ClimateForecastCardProps) {
  if (!projection || Object.keys(projection).length === 0) return null;

  const tempChange = typeof projection.temp_change === 'number' ? projection.temp_change : null;
  const precipChange = typeof projection.precip_change_pct === 'number' ? projection.precip_change_pct : null;

  if (tempChange === null && precipChange === null) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      {/* Title */}
      <div className="flex items-center gap-2 mb-3">
        <Thermometer className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Climate Outlook (2050)</span>
      </div>

      {/* Metric boxes */}
      <div className="grid grid-cols-2 gap-3">
        {/* Temperature */}
        {tempChange !== null && (
          <div className="rounded-lg bg-muted/40 p-3 text-center">
            <Thermometer className="h-5 w-5 mx-auto mb-1.5 text-red-400" />
            <div className="flex items-center justify-center gap-0.5">
              <ArrowUp className="h-3.5 w-3.5 text-red-500" />
              <span className={`text-xl font-bold tabular-nums ${tempChange >= 2 ? 'text-red-500' : 'text-amber-500'}`}>
                +{tempChange.toFixed(1)}°C
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">avg temperature</p>
          </div>
        )}

        {/* Precipitation */}
        {precipChange !== null && (
          <div className="rounded-lg bg-muted/40 p-3 text-center">
            <CloudRain className="h-5 w-5 mx-auto mb-1.5 text-blue-400" />
            <div className="flex items-center justify-center gap-0.5">
              {precipChange >= 0 ? (
                <ArrowUp className="h-3.5 w-3.5 text-blue-500" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5 text-blue-500" />
              )}
              <span className="text-xl font-bold tabular-nums text-blue-500">
                {precipChange >= 0 ? '+' : ''}{precipChange.toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">rainfall change</p>
          </div>
        )}
      </div>

      {/* Note */}
      <p className="text-[10px] text-muted-foreground mt-3">
        Based on NIWA climate projections for this region
      </p>
    </div>
  );
}
