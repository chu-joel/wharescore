'use client';

import { DollarSign, TrendingUp } from 'lucide-react';
import { RentBandGauge } from '@/components/property/RentBandGauge';
import { formatCurrency } from '@/lib/format';
import type { ReportSnapshot, RentBaseline } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
  persona: string;
  rentBand: {
    baseline: RentBaseline | null;
    bandLow: number;
    bandHigh: number;
    bandLowOuter: number;
    bandHighOuter: number;
    verdict: string | null;
    diffPct: number | null;
  };
  userRent: number | null;
}

export function QuickVerdict({ snapshot, persona, rentBand, userRent }: Props) {
  if (persona === 'renter') {
    return <RenterVerdict rentBand={rentBand} userRent={userRent} />;
  }
  return <BuyerVerdict snapshot={snapshot} />;
}

// Map the full-report rent verdict keys (below-market / fair / slightly-high / high / very-high)
// to a compact label + color. Previously this used mis-named keys ("below", "above") that never fired,
// so the verdict badge was always blank.
const VERDICT_MAP: Record<string, { label: string; color: string }> = {
  'below-market': { label: 'Below market', color: 'text-emerald-600 dark:text-emerald-400' },
  'fair': { label: 'Fair', color: 'text-emerald-600 dark:text-emerald-400' },
  'slightly-high': { label: 'Slightly high', color: 'text-amber-600 dark:text-amber-400' },
  'high': { label: 'High', color: 'text-red-600 dark:text-red-400' },
  'very-high': { label: 'Well above market', color: 'text-red-600 dark:text-red-400' },
};

function RenterVerdict({ rentBand, userRent }: { rentBand: Props['rentBand']; userRent: number | null }) {
  const { baseline, bandLow, bandHigh, bandLowOuter, bandHighOuter, verdict } = rentBand;
  if (!baseline || !bandLow) return null;

  // The fair rent headline should show the MIDPOINT of the fair band for THIS property
  // (bedrooms + condition + hazards), not the area all-beds median. Previously this
  // rendered the area median which was frequently below the fair-band floor, confusing renters.
  const fairMid = Math.round((bandLow + bandHigh) / 2);

  const v = verdict ? VERDICT_MAP[verdict] : null;
  const hasUserRent = userRent && userRent > 0;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">Rent Verdict</h3>
        {v && hasUserRent && (
          <span className={`ml-auto text-sm font-semibold ${v.color}`}>{v.label}</span>
        )}
      </div>
      <div className="px-5 pb-5 space-y-4">
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums">${fairMid}</p>
          <p className="text-xs text-muted-foreground">
            estimated fair rent /week
            <span className="block mt-0.5 text-muted-foreground/70">Fair band: ${bandLow}–${bandHigh}/wk</span>
          </p>
        </div>
        {hasUserRent ? (
          <RentBandGauge
            bandLow={bandLow}
            bandHigh={bandHigh}
            bandLowOuter={bandLowOuter}
            bandHighOuter={bandHighOuter}
            userRent={userRent}
            rawMedian={baseline.raw_median}
          />
        ) : (
          // No user-entered rent yet — skip the "Your rent" gauge (which previously rendered
          // a fake default) and show the suburb band with a prompt to upgrade for interactivity.
          <div className="rounded-lg bg-muted/40 border border-dashed border-border p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Upgrade to the Full Report to enter your own rent and see a personalised fairness verdict.
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center">
          Area median: ${Math.round(baseline.raw_median)}/wk · {baseline.bond_count} recent bonds
        </p>
      </div>
    </div>
  );
}

function BuyerVerdict({ snapshot }: { snapshot: ReportSnapshot }) {
  const pa = snapshot.price_advisor;
  if (!pa) return null;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">Price Estimate</h3>
      </div>
      <div className="px-5 pb-5 space-y-3">
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums">{formatCurrency(pa.estimated_value)}</p>
          <p className="text-xs text-muted-foreground">estimated value</p>
        </div>
        <div className="flex justify-center gap-4 text-center">
          <div>
            <p className="text-sm font-medium tabular-nums">{formatCurrency(pa.band_low)}</p>
            <p className="text-xs text-muted-foreground">Low</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-sm font-medium tabular-nums">{formatCurrency(pa.band_high)}</p>
            <p className="text-xs text-muted-foreground">High</p>
          </div>
        </div>
        {pa.cv && (
          <p className="text-xs text-center text-muted-foreground">
            Council valuation: {formatCurrency(pa.cv)}
            {pa.cv_date && <span> ({pa.cv_date})</span>}
          </p>
        )}
      </div>
    </div>
  );
}
