'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface TrajectoryIndicatorProps {
  report: PropertyReport;
}

type Direction = 'improving' | 'stable' | 'declining';

interface Signal {
  label: string;
  direction: Direction;
  weight: number;
}

function computeTrajectory(report: PropertyReport): { direction: Direction; confidence: number; signals: Signal[] } {
  const signals: Signal[] = [];
  const l = report.liveability;
  const m = report.market;
  const p = report.planning;

  // Crime trend (higher weight)
  if (l.crime_rate != null) {
    if (l.crime_rate <= 35) {
      signals.push({ label: 'Low crime area', direction: 'improving', weight: 3 });
    } else if (l.crime_rate >= 70) {
      signals.push({ label: 'High crime area', direction: 'declining', weight: 3 });
    } else {
      signals.push({ label: 'Average crime levels', direction: 'stable', weight: 1 });
    }
  }

  // Rent growth as economic signal
  if (m.trend?.cagr_5yr != null) {
    if (m.trend.cagr_5yr > 3) {
      signals.push({ label: `Rents rising ${m.trend.cagr_5yr.toFixed(1)}%/yr`, direction: 'improving', weight: 2 });
    } else if (m.trend.cagr_5yr < -1) {
      signals.push({ label: `Rents declining ${Math.abs(m.trend.cagr_5yr).toFixed(1)}%/yr`, direction: 'declining', weight: 2 });
    } else {
      signals.push({ label: 'Stable rents', direction: 'stable', weight: 1 });
    }
  }

  // Resource consent activity as development signal
  if (p.consent_count != null) {
    if (p.consent_count >= 10) {
      signals.push({ label: `${p.consent_count} recent consents`, direction: 'improving', weight: 2 });
    } else if (p.consent_count >= 3) {
      signals.push({ label: `${p.consent_count} recent consents`, direction: 'stable', weight: 1 });
    }
  }

  // Infrastructure projects
  if (p.infrastructure_count != null && p.infrastructure_count >= 2) {
    signals.push({ label: `${p.infrastructure_count} infrastructure projects`, direction: 'improving', weight: 2 });
  }

  // NZDep as baseline
  if (l.nzdep_score != null) {
    if (l.nzdep_score <= 3) {
      signals.push({ label: 'Low deprivation area', direction: 'improving', weight: 1 });
    } else if (l.nzdep_score >= 8) {
      signals.push({ label: 'High deprivation area', direction: 'declining', weight: 1 });
    }
  }

  if (signals.length === 0) {
    return { direction: 'stable', confidence: 0, signals: [] };
  }

  // Weighted score: +weight for improving, -weight for declining
  const weightedSum = signals.reduce((s, sig) => {
    if (sig.direction === 'improving') return s + sig.weight;
    if (sig.direction === 'declining') return s - sig.weight;
    return s;
  }, 0);

  const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
  const normalized = weightedSum / totalWeight;
  const confidence = Math.min(100, Math.round((signals.length / 5) * 100));

  const direction: Direction = normalized > 0.2 ? 'improving' : normalized < -0.2 ? 'declining' : 'stable';

  return { direction, confidence, signals };
}

const DIRECTION_CONFIG: Record<Direction, {
  Icon: typeof TrendingUp;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  improving: {
    Icon: TrendingUp,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200 dark:border-green-800',
    label: 'Improving',
  },
  stable: {
    Icon: Minus,
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-950/20',
    border: 'border-gray-200 dark:border-gray-700',
    label: 'Stable',
  },
  declining: {
    Icon: TrendingDown,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    label: 'Declining',
  },
};

export function TrajectoryIndicator({ report }: TrajectoryIndicatorProps) {
  const { direction, confidence, signals } = computeTrajectory(report);

  if (signals.length === 0) return null;

  const config = DIRECTION_CONFIG[direction];
  const Icon = config.Icon;

  // Compute a visual score: improving signals count vs declining
  const improvingCount = signals.filter(s => s.direction === 'improving').length;
  const decliningCount = signals.filter(s => s.direction === 'declining').length;
  const stableCount = signals.filter(s => s.direction === 'stable').length;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 space-y-3`}>
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
          direction === 'improving' ? 'bg-green-100 dark:bg-green-900/40' :
          direction === 'declining' ? 'bg-red-100 dark:bg-red-900/40' :
          'bg-gray-100 dark:bg-gray-800/40'
        }`}>
          <Icon className={`h-5 w-5 ${config.color}`} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold ${config.color}`}>
            Neighbourhood Trajectory: {config.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {improvingCount > 0 && <span className="text-green-600 dark:text-green-400">{improvingCount} positive</span>}
            {improvingCount > 0 && (stableCount > 0 || decliningCount > 0) && ' · '}
            {stableCount > 0 && <span>{stableCount} neutral</span>}
            {stableCount > 0 && decliningCount > 0 && ' · '}
            {decliningCount > 0 && <span className="text-red-500">{decliningCount} concern{decliningCount > 1 ? 's' : ''}</span>}
          </p>
        </div>
      </div>

      {/* Signal indicator bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        {signals.map((sig, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full ${
              sig.direction === 'improving' ? 'bg-green-400' :
              sig.direction === 'declining' ? 'bg-red-400' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>

      <ul className="space-y-1">
        {signals.map((sig, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              sig.direction === 'improving' ? 'bg-green-500' :
              sig.direction === 'declining' ? 'bg-red-500' : 'bg-gray-400'
            }`} />
            {sig.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
