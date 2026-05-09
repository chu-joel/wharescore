'use client';

import { AlertTriangle, Shield } from 'lucide-react';
import { PriceBandGauge } from '@/components/property/PriceBandGauge';
import { useHostedReportStore } from '@/stores/hostedReportStore';
import { formatCurrency } from '@/lib/format';
import type {
  ReportSnapshot, PriceMethodologyStep, HazardCostFlag, PriceAdjustment,
} from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

const VERDICT: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'well-below': { label: 'Asking price is well below estimated value', color: 'var(--ws-success)',  bg: 'rgba(45,106,79,.05)', border: 'rgba(45,106,79,.30)' },
  'below':      { label: 'Asking price is below estimated value',      color: 'var(--ws-success)',  bg: 'rgba(45,106,79,.05)', border: 'rgba(45,106,79,.30)' },
  'fair':       { label: 'Asking price looks fair',                    color: 'var(--ws-success)',  bg: 'rgba(45,106,79,.05)', border: 'rgba(45,106,79,.30)' },
  'above':      { label: 'Asking price is above estimated value',      color: 'oklch(0.50 0.13 75)', bg: 'rgba(230,159,0,.05)', border: 'rgba(230,159,0,.30)' },
  'well-above': { label: 'Asking price is well above estimated value', color: 'var(--ws-r-vhigh)',  bg: 'rgba(196,45,45,.04)', border: 'rgba(196,45,45,.30)' },
};

function shortCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(v / 1000)}K`;
}

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1000)}K`;
  return `${sign}$${abs}`;
}

export function HostedPriceAdvisorNew({ snapshot, persona }: { snapshot: ReportSnapshot; persona: string }) {
  const askingPrice = useHostedReportStore((s) => s.askingPrice);
  const pa = snapshot.price_advisor;
  if (!pa || persona !== 'buyer') return null;

  let askingVerdict: string | null = pa.asking_verdict;
  let askingDiffPct: number | null = pa.asking_diff_pct;
  const effectiveAsking = askingPrice ?? pa.asking_price;
  if (effectiveAsking && effectiveAsking !== pa.asking_price) {
    const mid = (pa.band_low + pa.band_high) / 2;
    askingDiffPct = Math.round(((effectiveAsking - mid) / mid) * 100 * 10) / 10;
    if (effectiveAsking < pa.band_low_outer) askingVerdict = 'well-below';
    else if (effectiveAsking < pa.band_low) askingVerdict = 'below';
    else if (effectiveAsking <= pa.band_high) askingVerdict = 'fair';
    else if (effectiveAsking <= pa.band_high_outer) askingVerdict = 'above';
    else askingVerdict = 'well-above';
  }
  const vc = askingVerdict ? VERDICT[askingVerdict] : null;

  return (
    <Card>
      <CardHead title="Property value estimate" meta={pa.method ?? 'ensemble'} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 16 }}>
        {/* Hero estimate */}
        <div style={{ textAlign: 'center', display: 'grid', gap: 4 }}>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Estimated market value
          </p>
          <p style={{
            margin: 0, fontSize: 32, fontWeight: 800, color: 'var(--ws-piq-dark)',
            letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {formatCurrency(pa.estimated_value)}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-mute)' }}>
            {shortCurrency(pa.band_low)} - {shortCurrency(pa.band_high)}
          </p>
        </div>

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
          <div style={{
            border: `1px solid ${vc.border}`, background: vc.bg,
            borderRadius: 'var(--ws-radius)', padding: 12,
          }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: vc.color }}>{vc.label}</p>
            {askingDiffPct !== null && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)' }}>
                {Math.abs(askingDiffPct)}% {askingDiffPct > 0 ? 'above' : 'below'} our estimate of {formatCurrency(pa.estimated_value)}.
              </p>
            )}
          </div>
        )}

        {/* Methodology */}
        {pa.methodology_steps && pa.methodology_steps.length > 0 && (
          <div>
            <h4 style={subHeading}>How we estimated this</h4>
            <div style={{ display: 'grid', gap: 6 }}>
              {pa.methodology_steps.map((step: PriceMethodologyStep) => (
                <div key={step.step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: 'rgba(13,115,119,.10)', color: 'var(--ws-piq)',
                    fontSize: 11, fontWeight: 700,
                    display: 'inline-grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    {step.step}
                  </span>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ws-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {step.label}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ws-ink)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {shortCurrency(step.value)}
                  </span>
                </div>
              ))}
            </div>
            {pa.methods_agree_pct !== null && (
              <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
                Methods {pa.methods_agree_pct < 10 ? 'agree' : 'diverge'} ({pa.methods_agree_pct}% difference).
                {pa.cv_age_months ? ` CV is ${pa.cv_age_months} months old.` : ''}
              </p>
            )}
          </div>
        )}

        {/* Adjustments */}
        {pa.adjustments && pa.adjustments.length > 0 && (
          <div>
            <h4 style={subHeading}>What moved your estimate</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {pa.adjustments.map((adj: PriceAdjustment) => {
                const negative = adj.pct_high < 0;
                const tone = negative ? 'var(--ws-warm)' : 'var(--ws-success)';
                const pctLabel = `${adj.pct_low > 0 ? '+' : ''}${adj.pct_low}% to ${adj.pct_high > 0 ? '+' : ''}${adj.pct_high}%`;
                const dollarLabel = `${fmtDollar(adj.dollar_low)} to ${fmtDollar(adj.dollar_high)}`;
                return (
                  <div key={adj.factor} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: 50,
                      flexShrink: 0, marginTop: 7, background: tone,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 500, color: 'var(--ws-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {adj.label}
                        </span>
                        <span style={{ fontWeight: 600, color: tone, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {pctLabel}
                        </span>
                      </div>
                      {adj.reason && (
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, color: 'var(--ws-ink-soft)' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adj.reason}</span>
                          <span style={{ color: tone, opacity: 0.85, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{dollarLabel}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hazard cost flags */}
        {pa.hazard_cost_flags && pa.hazard_cost_flags.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--ws-r-vhigh)',
            }}>
              <Shield size={13} /> Ownership risk flags
            </div>
            {pa.hazard_cost_flags.map((f: HazardCostFlag) => (
              <div key={f.hazard} style={{
                border: '1px solid rgba(196,45,45,.20)', background: 'rgba(196,45,45,.04)',
                borderRadius: 'var(--ws-radius-sm)', padding: 12, display: 'grid', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ws-r-vhigh)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} /> {f.label}
                  </span>
                  {(f.insurance_uplift_pct_low > 0 || f.insurance_uplift_pct_high > 0) && (
                    <span style={{ fontSize: 11.5, color: 'var(--ws-r-vhigh)', whiteSpace: 'nowrap' }}>
                      +{f.insurance_uplift_pct_low}-{f.insurance_uplift_pct_high}% insurance
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>{f.description}</p>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 500, color: 'var(--ws-piq-dark)' }}>{f.action}</p>
              </div>
            ))}
          </div>
        )}

        {/* Ownership costs */}
        {pa.ownership_costs && (
          <div style={{
            background: 'var(--ws-bg-2)', border: '1px solid var(--ws-rule)',
            borderRadius: 'var(--ws-radius-sm)', padding: 12, display: 'grid', gap: 6,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ws-ink-mute)' }}>
              Annual ownership costs
            </div>
            <dl style={{ display: 'grid', gap: 4, margin: 0, fontSize: 12 }}>
              {pa.ownership_costs.rates_annual !== null && (
                <div style={dlRow}>
                  <dt style={{ color: 'var(--ws-ink-soft)' }}>Rates</dt>
                  <dd style={{ margin: 0, fontWeight: 500, color: 'var(--ws-ink)', fontVariantNumeric: 'tabular-nums' }}>
                    ${pa.ownership_costs.rates_annual.toLocaleString('en-NZ')}/yr
                  </dd>
                </div>
              )}
              <div style={dlRow}>
                <dt style={{ color: 'var(--ws-ink-soft)' }}>Insurance</dt>
                <dd style={{ margin: 0, fontWeight: 500, color: 'var(--ws-ink)', fontVariantNumeric: 'tabular-nums' }}>
                  ${pa.ownership_costs.insurance_annual_low.toLocaleString('en-NZ')}
                  {pa.ownership_costs.insurance_annual_low !== pa.ownership_costs.insurance_annual_high &&
                    `-$${pa.ownership_costs.insurance_annual_high.toLocaleString('en-NZ')}`}
                  /yr
                </dd>
              </div>
              {pa.is_multi_unit && pa.ownership_costs.body_corp_annual && (
                <div style={dlRow}>
                  <dt style={{ color: 'var(--ws-ink-soft)' }}>Body corp</dt>
                  <dd style={{ margin: 0, fontWeight: 500, color: 'var(--ws-ink)', fontVariantNumeric: 'tabular-nums' }}>
                    ${pa.ownership_costs.body_corp_annual.toLocaleString('en-NZ')}/yr
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>{pa.disclaimer}</p>
      </div>
    </Card>
  );
}

const subHeading: React.CSSProperties = {
  margin: '0 0 8px', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ws-ink-mute)',
};
const dlRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8 };
