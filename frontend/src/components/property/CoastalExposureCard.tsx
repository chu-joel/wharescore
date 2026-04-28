'use client';

import { Waves } from 'lucide-react';
import type { CoastalExposure, CoastalTier } from '@/components/report/HostedCoastalTimeline';

interface Props {
  coastal: CoastalExposure;
  persona?: 'renter' | 'buyer';
}

const TIER_LABELS: Record<CoastalTier, string> = {
  happens_now: 'Happens now',
  within_30_years: 'Within 30 years',
  longer_term: 'Longer-term',
  not_applicable: 'Not applicable',
};

// Per-tier styling. happens_now matches the critical-finding wrapper in
// RiskHazardsSection (thick left border + soft shadow) so it sits visually
// alongside other critical hazards. Lower tiers step down progressively.
const TIER_STYLES: Record<CoastalTier, {
  card: string;
  iconBg: string;
  iconFg: string;
  pill: string;
}> = {
  happens_now: {
    card: 'border-l-[5px] border-risk-very-high rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 shadow-sm shadow-red-200 dark:shadow-red-900/50',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconFg: 'text-red-600 dark:text-red-400',
    pill: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
  within_30_years: {
    card: 'border-l-[5px] border-amber-500 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconFg: 'text-amber-600 dark:text-amber-400',
    pill: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  longer_term: {
    card: 'rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/15',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconFg: 'text-blue-600 dark:text-blue-400',
    pill: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  not_applicable: {
    card: 'rounded-xl border border-border',
    iconBg: 'bg-muted',
    iconFg: 'text-muted-foreground',
    pill: 'bg-muted text-muted-foreground',
  },
};

/** Compact coastal-exposure card for the free on-screen report. Mirrors
 *  the EarthquakeDetailCard / critical-finding patterns from RiskHazardsSection
 *  so it sits cleanly alongside other hazard cards. The full narrative,
 *  scenario table, and score breakdown live in the paid hosted report. */
export function CoastalExposureCard({ coastal, persona }: Props) {
  if (coastal.tier === 'not_applicable') return null;
  // Renter only sees life-safety tier on-screen (matches hosted behaviour).
  if (persona === 'renter' && coastal.tier !== 'happens_now') return null;

  const style = TIER_STYLES[coastal.tier];
  const vlm = coastal.vlm_mm_yr;
  const showVlm = vlm != null && Math.abs(vlm) >= 1;

  return (
    <div className={`${style.card} p-3.5 flex items-start gap-2.5`}>
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${style.iconBg}`}>
        <Waves className={`h-4 w-4 ${style.iconFg}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <span className="text-sm font-bold">Coastal & sea level</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${style.pill}`}>
            {TIER_LABELS[coastal.tier]}
          </span>
        </div>
        <p className="text-sm font-semibold leading-snug mb-2">{coastal.headline}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">{coastal.ground_elevation_m.toFixed(1)}m</span>{' '}
            above high tide
          </span>
          {showVlm && (
            <span className="text-muted-foreground">
              Ground is{' '}
              <span className="text-foreground font-medium">
                {vlm! < 0 ? 'sinking slowly' : 'rising slowly'}
              </span>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/80 mt-2 leading-snug">
          Full timeline with 3-scenario sea-level projections to 2150 in the hosted report.
        </p>
      </div>
    </div>
  );
}
