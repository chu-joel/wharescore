'use client';

import { BarChart3 } from 'lucide-react';
import type { PropertyReport, ComparisonData } from '@/lib/types';

interface ComparisonBarsProps {
  report: PropertyReport;
}

interface BarRow {
  label: string;
  property: number | null;
  suburb: number | null;
  city: number | null;
  lowerIsBetter: boolean;
  unit?: string;
}

function buildRows(report: PropertyReport, comparisons: ComparisonData): BarRow[] {
  const rows: BarRow[] = [];
  const { suburb, city } = comparisons;

  if (report.liveability.nzdep_score != null) {
    rows.push({
      // NZDep is 1–10 where 10 = most deprived. Surfacing that inline
      // avoids users assuming it's a percentile or letter-grade.
      label: 'Deprivation (NZDep 1–10, 10 = most deprived)',
      property: report.liveability.nzdep_score,
      suburb: suburb?.avg_nzdep ?? null,
      city: city?.avg_nzdep ?? null,
      lowerIsBetter: true,
    });
  }

  if (report.liveability.school_count != null) {
    rows.push({
      label: 'Schools within 1.5 km',
      property: report.liveability.school_count,
      suburb: suburb?.school_count_1500m ?? null,
      city: city?.school_count_1500m ?? null,
      lowerIsBetter: false,
    });
  }

  if (report.liveability.transit_count != null) {
    rows.push({
      label: 'Transit stops within 400 m',
      property: report.liveability.transit_count,
      suburb: suburb?.transit_count_400m ?? null,
      city: city?.transit_count_400m ?? null,
      lowerIsBetter: false,
    });
  }

  if (report.environment.noise_db != null) {
    // Match NoiseLevelGauge (and the rest of the noise UI) which rounds
    // to whole decibels — prevents "66dB here, 69dB two sections down"
    // on the same report.
    rows.push({
      label: 'Road noise',
      property: Math.round(report.environment.noise_db),
      suburb: suburb?.max_noise_db != null ? Math.round(suburb.max_noise_db) : null,
      city: city?.max_noise_db != null ? Math.round(city.max_noise_db) : null,
      lowerIsBetter: true,
      unit: 'dB',
    });
  }

  if (report.hazards.epb_count != null) {
    rows.push({
      label: 'Earthquake-prone buildings within 300 m',
      property: report.hazards.epb_count,
      suburb: suburb?.epb_count_300m ?? null,
      city: city?.epb_count_300m ?? null,
      lowerIsBetter: true,
    });
  }

  return rows;
}

function Bar({ value, maxVal, color }: { value: number; maxVal: number; color: string }) {
  const pct = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
  return (
    <div className="h-3 bg-muted rounded-full overflow-hidden flex-1">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

function contextLabel(property: number, avg: number, lowerIsBetter: boolean): string {
  const diff = property - avg;
  const pct = avg !== 0 ? Math.abs(diff / avg) * 100 : 0;
  if (pct < 10) return 'Typical for the area';
  const direction = diff > 0 ? 'higher' : 'lower';
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const tag = good ? 'better' : 'worse';
  return `${Math.round(pct)}% ${direction} than average (${tag})`;
}

function formatVal(v: number | null, unit?: string): string {
  if (v == null) return '–';
  const rounded = Number.isInteger(v) ? v : Number(v.toFixed(1));
  return unit ? `${rounded}${unit}` : `${rounded}`;
}

export function ComparisonBars({ report }: ComparisonBarsProps) {
  const comparisons = report.comparisons;
  if (!comparisons || (!comparisons.suburb && !comparisons.city)) return null;

  const rows = buildRows(report, comparisons);
  if (rows.length === 0) return null;

  const suburbLabel = comparisons.suburb?.label ?? 'Suburb';
  const cityLabel = comparisons.city?.label ?? 'City';

  return (
    <div className="rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-piq-primary" />
        <h3 className="text-sm font-semibold">How does this property compare?</h3>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-piq-primary" />
          This property
        </span>
        {comparisons.suburb && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-piq-primary/40" />
            {suburbLabel}
          </span>
        )}
        {comparisons.city && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            {cityLabel}
          </span>
        )}
      </div>

      {/* Bars */}
      <div className="space-y-4">
        {rows.map((row) => {
          const vals = [row.property, row.suburb, row.city].filter((v): v is number => v != null);
          const maxVal = Math.max(...vals, 1);

          // Context insight
          const compareBase = row.suburb ?? row.city;
          const insight = row.property != null && compareBase != null
            ? contextLabel(row.property, compareBase, row.lowerIsBetter)
            : null;

          return (
            <div key={row.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{row.label}</span>
                {insight && (
                  <span className="text-[10px] text-muted-foreground">{insight}</span>
                )}
              </div>

              {/* Property bar */}
              {row.property != null && (
                <div className="flex items-center gap-2">
                  <Bar value={row.property} maxVal={maxVal} color="bg-piq-primary" />
                  <span className="text-xs font-semibold w-10 text-right">{formatVal(row.property, row.unit)}</span>
                </div>
              )}

              {/* Suburb bar */}
              {row.suburb != null && (
                <div className="flex items-center gap-2">
                  <Bar value={row.suburb} maxVal={maxVal} color="bg-piq-primary/40" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{formatVal(row.suburb, row.unit)}</span>
                </div>
              )}

              {/* City bar */}
              {row.city != null && (
                <div className="flex items-center gap-2">
                  <Bar value={row.city} maxVal={maxVal} color="bg-muted-foreground/30" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{formatVal(row.city, row.unit)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
