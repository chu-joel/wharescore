'use client';

import { AlertTriangle, Shield } from 'lucide-react';
import { PriceBandGauge } from '@/components/property/PriceBandGauge';
import { useHostedReportStore } from '@/stores/hostedReportStore';
import { formatCurrency } from '@/lib/format';
import type { ReportSnapshot, PriceAdvisorResult, PriceMethodologyStep, HazardCostFlag } from '@/lib/types';

interface HostedPriceAdvisorProps {
  snapshot: ReportSnapshot;
  persona: string;
}

const ASKING_VERDICT: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'well-below': { label: 'Asking price is well below estimated value', color: 'text-piq-success', bg: 'bg-piq-success/5', border: 'border-piq-success/30' },
  'below': { label: 'Asking price is below estimated value', color: 'text-piq-success', bg: 'bg-piq-success/5', border: 'border-piq-success/30' },
  'fair': { label: 'Asking price looks fair', color: 'text-piq-success', bg: 'bg-piq-success/5', border: 'border-piq-success/30' },
  'above': { label: 'Asking price is above estimated value', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-500/5', border: 'border-yellow-500/30' },
  'well-above': { label: 'Asking price is well above estimated value', color: 'text-risk-high', bg: 'bg-red-50 dark:bg-risk-high/5', border: 'border-risk-high/30' },
};

export function HostedPriceAdvisor({ snapshot, persona }: HostedPriceAdvisorProps) {
  const askingPrice = useHostedReportStore((s) => s.askingPrice);
  const pa = snapshot.price_advisor;

  if (!pa || persona !== 'buyer') return null;

  // Client-side asking price comparison against frozen estimate
  let askingVerdict: string | null = pa.asking_verdict;
  let askingDiffPct: number | null = pa.asking_diff_pct;
  const effectiveAsking = askingPrice ?? pa.asking_price;

  if (effectiveAsking && effectiveAsking !== pa.asking_price) {
    // Recompute verdict for user-entered asking price
    const mid = (pa.band_low + pa.band_high) / 2;
    askingDiffPct = Math.round(((effectiveAsking - mid) / mid) * 100 * 10) / 10;
    if (effectiveAsking < pa.band_low_outer) askingVerdict = 'well-below';
    else if (effectiveAsking < pa.band_low) askingVerdict = 'below';
    else if (effectiveAsking <= pa.band_high) askingVerdict = 'fair';
    else if (effectiveAsking <= pa.band_high_outer) askingVerdict = 'above';
    else askingVerdict = 'well-above';
  }

  const vc = askingVerdict ? ASKING_VERDICT[askingVerdict] : null;

  const shortCurrency = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    return `$${Math.round(v / 1000)}K`;
  };

  return (
    <div className="rounded-xl border border-border bg-card card-elevated p-5 space-y-5">
      <h3 className="text-lg font-bold">Property Value Estimate</h3>

      {/* Estimated value hero */}
      <div className="text-center space-y-1">
        <p className="text-xs text-muted-foreground">Estimated market value</p>
        <p className="text-3xl font-bold tabular-nums text-piq-primary">{formatCurrency(pa.estimated_value)}</p>
        <p className="text-xs text-muted-foreground">
          {shortCurrency(pa.band_low)} – {shortCurrency(pa.band_high)}
        </p>
      </div>

      {/* Band gauge */}
      <PriceBandGauge
        bandLow={pa.band_low}
        bandHigh={pa.band_high}
        bandLowOuter={pa.band_low_outer}
        bandHighOuter={pa.band_high_outer}
        askingPrice={effectiveAsking}
        estimatedValue={pa.estimated_value}
      />

      {/* Asking price verdict */}
      {vc && effectiveAsking && (
        <div className={`rounded-lg border p-3 ${vc.bg} ${vc.border}`}>
          <p className={`text-sm font-semibold ${vc.color}`}>{vc.label}</p>
          {askingDiffPct !== null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {Math.abs(askingDiffPct)}% {askingDiffPct > 0 ? 'above' : 'below'} our estimate of {formatCurrency(pa.estimated_value)}
            </p>
          )}
        </div>
      )}

      {/* Methodology */}
      {pa.methodology_steps && pa.methodology_steps.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">How we estimated this</h4>
          <div className="space-y-1.5">
            {pa.methodology_steps.map((step: PriceMethodologyStep) => (
              <div key={step.step} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-piq-primary/10 text-piq-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {step.step}
                </span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{step.label}</span>
                <span className="text-xs font-semibold tabular-nums shrink-0">{shortCurrency(step.value)}</span>
              </div>
            ))}
          </div>
          {pa.methods_agree_pct !== null && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Methods {pa.methods_agree_pct < 10 ? 'agree' : 'diverge'} ({pa.methods_agree_pct}% difference).
              {pa.cv_age_months ? ` CV is ${pa.cv_age_months} months old.` : ''}
            </p>
          )}
        </div>
      )}

      {/* Hazard cost flags */}
      {pa.hazard_cost_flags && pa.hazard_cost_flags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-risk-high" />
            <span className="text-sm font-semibold text-muted-foreground">Ownership risk flags</span>
          </div>
          {pa.hazard_cost_flags.map((f: HazardCostFlag) => (
            <div key={f.hazard} className="rounded-lg border border-risk-high/20 bg-risk-high/5 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-risk-high flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {f.label}
                </span>
                {(f.insurance_uplift_pct_low > 0 || f.insurance_uplift_pct_high > 0) && (
                  <span className="text-[10px] text-risk-high">
                    +{f.insurance_uplift_pct_low}–{f.insurance_uplift_pct_high}% insurance
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{f.description}</p>
              <p className="text-[10px] text-piq-primary font-medium">{f.action}</p>
            </div>
          ))}
        </div>
      )}

      {/* Ownership costs */}
      {pa.ownership_costs && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Annual ownership costs</p>
          <dl className="space-y-1 text-xs">
            {pa.ownership_costs.rates_annual !== null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rates</dt>
                <dd className="font-medium tabular-nums">${pa.ownership_costs.rates_annual.toLocaleString('en-NZ')}/yr</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Insurance</dt>
              <dd className="font-medium tabular-nums">
                ${pa.ownership_costs.insurance_annual_low.toLocaleString('en-NZ')}
                {pa.ownership_costs.insurance_annual_low !== pa.ownership_costs.insurance_annual_high &&
                  `–$${pa.ownership_costs.insurance_annual_high.toLocaleString('en-NZ')}`
                }/yr
              </dd>
            </div>
            {pa.is_multi_unit && pa.ownership_costs.body_corp_annual && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Body corp</dt>
                <dd className="font-medium tabular-nums">${pa.ownership_costs.body_corp_annual.toLocaleString('en-NZ')}/yr</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">{pa.disclaimer}</p>
    </div>
  );
}
