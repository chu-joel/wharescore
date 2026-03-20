'use client';

import { ShieldAlert, ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ContextBadge } from '@/components/common/ContextBadge';

interface CrimeCardProps {
  /** Crime percentile rank (0-100). Higher = more crime relative to city. */
  percentile: number | null;
  /** Raw victimisation count for this area unit */
  victimisations: number | null;
  /** City median victimisations for comparison */
  cityMedian: number | null;
}

function getSeverity(pct: number) {
  if (pct <= 25) return { label: 'Low Crime Area', color: '#2D6A4F', bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-200 dark:border-green-800', desc: 'Less crime than most areas in the city. Good for families and personal safety.' };
  if (pct <= 50) return { label: 'Below Average', color: '#0D7377', bg: 'bg-teal-50 dark:bg-teal-950/20', border: 'border-teal-200 dark:border-teal-800', desc: 'Crime levels are below the city average. A relatively safe area.' };
  if (pct <= 75) return { label: 'Above Average', color: '#E69F00', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', desc: 'More crime reported here than in most areas. Check specific crime types — property crime is most common.' };
  return { label: 'High Crime Area', color: '#C42D2D', bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-800', desc: 'This area has significantly higher crime rates. Factor in insurance costs and security measures.' };
}

export function CrimeCard({ percentile, victimisations, cityMedian }: CrimeCardProps) {
  if (percentile === null) return null;

  const severity = getSeverity(percentile);
  const IconComponent = percentile <= 50 ? ShieldCheck : ShieldAlert;

  // Comparison to city median
  let comparisonText: string | null = null;
  let ComparisonIcon = Minus;
  if (victimisations !== null && cityMedian !== null && cityMedian > 0) {
    const ratio = victimisations / cityMedian;
    if (ratio > 1.15) {
      const pctAbove = Math.round((ratio - 1) * 100);
      comparisonText = `${pctAbove}% above city median`;
      ComparisonIcon = TrendingUp;
    } else if (ratio < 0.85) {
      const pctBelow = Math.round((1 - ratio) * 100);
      comparisonText = `${pctBelow}% below city median`;
      ComparisonIcon = TrendingDown;
    } else {
      comparisonText = 'Near city median';
      ComparisonIcon = Minus;
    }
  }

  return (
    <div className={`rounded-xl border ${severity.border} ${severity.bg} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
          style={{ backgroundColor: `${severity.color}15` }}
        >
          <IconComponent className="h-5 w-5" style={{ color: severity.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: severity.color }}>
            {severity.label}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Based on NZ Police victimisation data (2022–2025)
          </p>
        </div>
      </div>

      {/* Percentile gauge */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Crime percentile</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: severity.color }}>
            {Math.round(percentile)}th
          </span>
        </div>
        <div className="relative h-3 rounded-full bg-gradient-to-r from-green-200 via-amber-200 to-red-300 dark:from-green-900 dark:via-amber-900 dark:to-red-900 overflow-hidden">
          {/* Marker */}
          <div
            className="absolute top-0 h-full w-1 bg-white shadow-md rounded-full"
            style={{ left: `${Math.min(Math.max(percentile, 2), 98)}%`, transform: 'translateX(-50%)' }}
          />
          <div
            className="absolute -top-0.5 w-3 h-4 rounded-sm"
            style={{
              left: `${Math.min(Math.max(percentile, 2), 98)}%`,
              transform: 'translateX(-50%)',
              backgroundColor: severity.color,
              border: '2px solid white',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-green-600 dark:text-green-400">Safest</span>
          <span className="text-[10px] text-muted-foreground">50th</span>
          <span className="text-[10px] text-red-500">Most crime</span>
        </div>
      </div>

      {/* Context badge */}
      {comparisonText && (
        <div>
          <ContextBadge
            text={comparisonText}
            sentiment={percentile <= 50 ? 'positive' : 'negative'}
          />
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-3">
        {victimisations !== null && (
          <div className="flex-1 rounded-lg bg-card dark:bg-card/50 border border-border p-2.5 text-center">
            <p className="text-lg font-bold tabular-nums">{victimisations.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">victimisations reported</p>
          </div>
        )}
        {comparisonText && (
          <div className="flex-1 rounded-lg bg-card dark:bg-card/50 border border-border p-2.5 text-center">
            <div className="flex items-center justify-center gap-1">
              <ComparisonIcon className="h-4 w-4" style={{ color: severity.color }} />
              <p className="text-xs font-semibold" style={{ color: severity.color }}>{comparisonText}</p>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">vs city average</p>
          </div>
        )}
      </div>

      {/* Context */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {severity.desc}
      </p>
    </div>
  );
}
