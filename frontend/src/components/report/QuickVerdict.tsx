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

function RenterVerdict({ rentBand, userRent }: { rentBand: Props['rentBand']; userRent: number | null }) {
  const { baseline, bandLow, bandHigh, bandLowOuter, bandHighOuter, verdict } = rentBand;
  if (!baseline || !bandLow) return null;

  const displayRent = userRent || baseline.raw_median;

  const verdictColor = verdict === 'below' || verdict === 'fair'
    ? 'text-emerald-600 dark:text-emerald-400'
    : verdict === 'above'
    ? 'text-amber-600 dark:text-amber-400'
    : verdict === 'well above'
    ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground';

  const verdictLabel = verdict === 'below' ? 'Below market' : verdict === 'fair' ? 'Fair' : verdict === 'above' ? 'Above market' : verdict === 'well above' ? 'Well above market' : 'Market rate';

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">Rent Verdict</h3>
        {verdict && (
          <span className={`ml-auto text-sm font-semibold ${verdictColor}`}>{verdictLabel}</span>
        )}
      </div>
      <div className="px-5 pb-5 space-y-4">
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums">${Math.round(baseline.raw_median)}</p>
          <p className="text-xs text-muted-foreground">estimated fair rent /week</p>
        </div>
        <RentBandGauge
          bandLow={bandLow}
          bandHigh={bandHigh}
          bandLowOuter={bandLowOuter}
          bandHighOuter={bandHighOuter}
          userRent={displayRent}
          rawMedian={baseline.raw_median}
        />
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
            <p className="text-[10px] text-muted-foreground">Low</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-sm font-medium tabular-nums">{formatCurrency(pa.band_high)}</p>
            <p className="text-[10px] text-muted-foreground">High</p>
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
