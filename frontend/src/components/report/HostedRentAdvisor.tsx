'use client';

import { AlertTriangle } from 'lucide-react';
import { RentBandGauge } from '@/components/property/RentBandGauge';
import type { ReportSnapshot, RentAdjustment, RentAreaContext } from '@/lib/types';

interface HostedRentAdvisorProps {
  snapshot: ReportSnapshot;
  rentBand: ReturnType<typeof import('@/stores/hostedReportStore').computeRentBand>;
  persona: string;
  userRent?: number | null;
}

const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'below-market': { label: "You're getting good value", color: 'text-piq-success', bg: 'bg-piq-success/5', border: 'border-piq-success/30' },
  'fair': { label: 'Your rent looks fair', color: 'text-piq-success', bg: 'bg-piq-success/5', border: 'border-piq-success/30' },
  'slightly-high': { label: 'Your rent is a bit high', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-500/5', border: 'border-yellow-500/30' },
  'high': { label: 'Your rent is high for this area', color: 'text-risk-high', bg: 'bg-red-50 dark:bg-risk-high/5', border: 'border-risk-high/30' },
  'very-high': { label: 'Your rent is well above market', color: 'text-risk-high', bg: 'bg-red-50 dark:bg-risk-high/5', border: 'border-risk-high/30' },
};

export function HostedRentAdvisor({ snapshot, rentBand, persona, userRent }: HostedRentAdvisorProps) {
  if (!rentBand.baseline) return null;
  if (persona !== 'renter') return null;

  const vc = rentBand.verdict ? VERDICT_CONFIG[rentBand.verdict] : null;
  const hazardAdjs = rentBand.baseline.adjustments.filter((a: RentAdjustment) => a.category === 'hazard');
  const positiveDeltas = rentBand.appliedDeltas.filter(d => d.pctHigh > 0);
  const negativeDeltas = rentBand.appliedDeltas.filter(d => d.pctHigh < 0);

  // Rental overview by dwelling type
  const rawMarket = (snapshot.report.market ?? {}) as Record<string, unknown>;
  const rentalOverview = (rawMarket.rental_overview ?? []) as { dwelling_type: string; beds: string | null; median: number; bond_count: number }[];

  return (
    <div className="rounded-xl border border-border bg-card card-elevated p-4 space-y-4">
      <h3 className="text-base font-bold">Is Your Rent Fair?</h3>

      {/* Verdict banner */}
      {vc && rentBand.verdict ? (
        <div className={`rounded-lg border p-4 ${vc.bg} ${vc.border}`}>
          <p className={`text-base font-bold ${vc.color}`}>{vc.label}</p>
          <p className="text-sm text-muted-foreground mt-1">
            We estimate fair rent at <strong>${rentBand.bandLow}–${rentBand.bandHigh}/wk</strong>.
            {rentBand.baseline.raw_median && (
              <span className="ml-1">Area median: ${rentBand.baseline.raw_median}/wk.</span>
            )}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-piq-primary/30 bg-piq-primary/5 p-4">
          <p className="text-base font-bold text-piq-primary">Fair Rent Estimate</p>
          <p className="text-sm text-muted-foreground mt-1">
            We estimate fair rent at <strong>${rentBand.bandLow}–${rentBand.bandHigh}/wk</strong>,
            with a possible range of ${rentBand.bandLowOuter}–${rentBand.bandHighOuter}/wk.
          </p>
        </div>
      )}

      {/* Band gauge */}
      <RentBandGauge
        bandLow={rentBand.bandLow}
        bandHigh={rentBand.bandHigh}
        bandLowOuter={rentBand.bandLowOuter}
        bandHighOuter={rentBand.bandHighOuter}
        userRent={userRent ?? rentBand.baseline.raw_median}
        rawMedian={rentBand.baseline.raw_median}
      />

      {/* What's influencing your rent — plain English */}
      {(rentBand.baseline.adjustments.length > 0 || rentBand.appliedDeltas.length > 0) && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">What's influencing your rent</h4>
          <div className="text-sm text-muted-foreground space-y-1.5">
            {/* Property-fixed adjustments (hazard + location) */}
            {rentBand.baseline.adjustments.map((adj: RentAdjustment) => (
              <div key={adj.factor} className="flex items-start gap-2">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                  adj.category === 'hazard' ? 'bg-risk-high' : adj.category === 'location' ? 'bg-blue-500' : 'bg-piq-success'
                }`} />
                <span>{adj.label}{adj.reason && adj.reason.toLowerCase() !== adj.label.toLowerCase() && <span className="opacity-60"> ({adj.reason})</span>}</span>
              </div>
            ))}
            {/* User-selected deltas */}
            {rentBand.appliedDeltas.map((d) => (
              <div key={d.label} className="flex items-start gap-2">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${d.pctHigh >= 0 ? 'bg-piq-success' : 'bg-piq-accent-warm'}`} />
                <span>{d.label} <span className="opacity-60">({d.pctLow > 0 ? '+' : ''}{d.pctLow}% to {d.pctHigh > 0 ? '+' : ''}{d.pctHigh}%)</span></span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Area median is ${rentBand.baseline.raw_median}/wk based on {rentBand.baseline.bond_count} recent bonds in {snapshot.meta.sa2_name}.
          </p>
        </div>
      )}

      {/* Hazard flags */}
      {hazardAdjs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hazardAdjs.map((h: RentAdjustment) => (
            <span
              key={h.factor}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-risk-high/10 text-risk-high border border-risk-high/20"
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              {h.label}
            </span>
          ))}
        </div>
      )}

      {/* Area context */}
      {rentBand.baseline.area_context.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-1.5">About {snapshot.meta.sa2_name}</h4>
          <div className="grid grid-cols-2 gap-1">
            {rentBand.baseline.area_context.map((ctx: RentAreaContext) => (
              <div key={ctx.factor} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`${
                  ctx.is_area_wide_hazard ? 'text-risk-high' : ctx.direction === 'up' ? 'text-piq-success' : ctx.direction === 'down' ? 'text-piq-accent-warm' : ''
                }`}>
                  {ctx.is_area_wide_hazard ? '!' : ctx.direction === 'up' ? '↑' : ctx.direction === 'down' ? '↓' : '–'}
                </span>
                <span className="truncate">{ctx.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rental overview by dwelling type */}
      {rentalOverview.length > 1 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-1.5">Area Rents by Type</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1 pr-2 font-semibold text-piq-primary">Type</th>
                  <th className="text-left py-1 pr-2 font-semibold text-piq-primary">Beds</th>
                  <th className="text-right py-1 pr-2 font-semibold text-piq-primary">Median</th>
                  <th className="text-right py-1 font-semibold text-piq-primary">Bonds</th>
                </tr>
              </thead>
              <tbody>
                {rentalOverview.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-1 pr-2 text-muted-foreground">{r.dwelling_type}</td>
                    <td className="py-1 pr-2 text-muted-foreground">{r.beds ?? 'All'}</td>
                    <td className="py-1 pr-2 text-right font-medium">${r.median}/wk</td>
                    <td className="py-1 text-right text-muted-foreground">{r.bond_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Based on MBIE bond records, council valuations, and hazard data. Not a registered valuation.
      </p>
    </div>
  );
}
