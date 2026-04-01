'use client';

import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceBandGauge } from './PriceBandGauge';
import { useBuyerInputStore } from '@/stores/buyerInputStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import type {
  PriceAdvisorResult,
  PriceAdjustment,
  PriceMethodologyStep,
  HazardCostFlag,
  OwnershipCosts,
} from '@/lib/types';

interface PriceAdvisorCardProps {
  addressId: number;
}

type FinishTier = 'basic' | 'standard' | 'modern' | 'premium' | 'luxury';
type Bedrooms = '1' | '2' | '3' | '4' | '5+';
type Bathrooms = '1' | '2' | '3+';

const BEDROOM_OPTIONS: Bedrooms[] = ['1', '2', '3', '4', '5+'];

const FINISH_TIERS: { value: FinishTier; label: string; description: string }[] = [
  { value: 'basic', label: 'Basic', description: 'Dated kitchen/bathroom, older carpets, basic fittings.' },
  { value: 'standard', label: 'Standard', description: 'Clean and tidy, no frills. Standard fittings.' },
  { value: 'modern', label: 'Modern', description: 'Recently renovated or built. Good fixtures.' },
  { value: 'premium', label: 'Premium', description: 'High-end finishes, designer kitchen, quality materials.' },
  { value: 'luxury', label: 'Luxury', description: 'Architect-designed, top-of-the-line appliances.' },
];

const BATHROOM_OPTIONS: Bathrooms[] = ['1', '2', '3+'];

const ASKING_VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'well-below': {
    label: 'Asking price is well below estimated value',
    color: 'text-piq-success',
    bg: 'bg-piq-success/5',
    border: 'border-piq-success/30',
  },
  'below': {
    label: 'Asking price is below estimated value',
    color: 'text-piq-success',
    bg: 'bg-piq-success/5',
    border: 'border-piq-success/30',
  },
  'fair': {
    label: 'Asking price looks fair',
    color: 'text-piq-success',
    bg: 'bg-piq-success/5',
    border: 'border-piq-success/30',
  },
  'above': {
    label: 'Asking price is above estimated value',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 dark:bg-yellow-500/5',
    border: 'border-yellow-500/30',
  },
  'well-above': {
    label: 'Asking price is well above estimated value',
    color: 'text-risk-high',
    bg: 'bg-red-50 dark:bg-risk-high/5',
    border: 'border-risk-high/30',
  },
};

function pillClass(selected: boolean) {
  return `rounded-full h-8 px-3 text-xs font-medium border transition-colors ${
    selected
      ? 'bg-piq-primary text-white border-piq-primary'
      : 'border-piq-primary text-piq-primary hover:bg-piq-primary/5'
  }`;
}

function smallPillClass(selected: boolean) {
  return `rounded-full h-7 px-3 text-xs font-medium border transition-colors ${
    selected
      ? 'bg-piq-primary text-white border-piq-primary'
      : 'border-piq-primary text-piq-primary hover:bg-piq-primary/5'
  }`;
}

const FREE_ADJUSTMENT_LIMIT = 2;
const FREE_STEP_LIMIT = 2;

export function PriceAdvisorCard({ addressId }: PriceAdvisorCardProps) {
  const askingPrice = useBuyerInputStore((s) => s.askingPrice);
  const bedrooms = useBuyerInputStore((s) => s.bedrooms) as Bedrooms | null;
  const finishTier = useBuyerInputStore((s) => s.finishTier) as FinishTier | null;
  const bathroomCount = useBuyerInputStore((s) => s.bathrooms) as Bathrooms | null;
  const hasParking = useBuyerInputStore((s) => s.hasParking);
  const setAskingPrice = useBuyerInputStore((s) => s.setAskingPrice);
  const setBedrooms = useBuyerInputStore((s) => s.setBedrooms);
  const setFinishTier = useBuyerInputStore((s) => s.setFinishTier);
  const setBathroomCount = useBuyerInputStore((s) => s.setBathrooms);
  const setHasParking = useBuyerInputStore((s) => s.setHasParking);

  const updateBuyer = useBudgetStore((s) => s.updateBuyer);

  // Sync asking price ↔ budget purchase price
  useEffect(() => {
    if (askingPrice) {
      updateBuyer(addressId, { purchasePrice: askingPrice });
    }
  }, [askingPrice, addressId, updateBuyer]);

  const [result, setResult] = useState<PriceAdvisorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);

  const selectedTierInfo = FINISH_TIERS.find((t) => t.value === finishTier);

  const handleAnalyse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (askingPrice) body.asking_price = askingPrice;
      if (bedrooms) body.bedrooms = bedrooms;
      if (finishTier) body.finish_tier = finishTier;
      if (bathroomCount) body.bathrooms = bathroomCount;
      if (hasParking !== null) body.has_parking = hasParking;

      const data = await apiFetch<PriceAdvisorResult>(
        `/api/v1/property/${addressId}/price-advisor`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      setResult(data);
    } catch {
      setError('Could not estimate value. Try again.');
    } finally {
      setLoading(false);
    }
  }, [addressId, askingPrice, bedrooms, finishTier, bathroomCount, hasParking]);

  const vc = result?.asking_verdict ? ASKING_VERDICT_CONFIG[result.asking_verdict] : null;

  const visibleAdj = result?.adjustments.slice(0, FREE_ADJUSTMENT_LIMIT) ?? [];
  const hiddenAdjCount = Math.max(0, (result?.adjustments.length ?? 0) - FREE_ADJUSTMENT_LIMIT);

  const visibleSteps = result?.methodology_steps.slice(0, FREE_STEP_LIMIT) ?? [];
  const hiddenStepCount = Math.max(0, (result?.methodology_steps.length ?? 0) - FREE_STEP_LIMIT);

  const shortCurrency = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    return `$${Math.round(v / 1000)}K`;
  };

  return (
    <div className="rounded-xl border border-border bg-card card-elevated p-3.5 space-y-4">
      {/* Header */}
      <span className="text-sm font-semibold">What&apos;s this property worth?</span>

      {/* Asking price input */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Asking / purchase price (optional)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <input
            type="number"
            value={askingPrice || ''}
            onChange={(e) => setAskingPrice(e.target.value ? parseInt(e.target.value) : null)}
            placeholder="e.g. 850000"
            className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm tabular-nums focus:border-piq-primary focus:ring-1 focus:ring-piq-primary/30 outline-none"
          />
        </div>
      </div>

      {/* Bedrooms */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Bedrooms</p>
        <div className="flex flex-wrap gap-1.5">
          {BEDROOM_OPTIONS.map((b) => (
            <button key={b} onClick={() => setBedrooms(b)} className={pillClass(bedrooms === b)}>
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Finish tier */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">How would you describe this property?</p>
        <div className="flex flex-wrap gap-1.5">
          {FINISH_TIERS.map((tier) => (
            <button
              key={tier.value}
              onClick={() => setFinishTier(tier.value)}
              className={pillClass(finishTier === tier.value)}
            >
              {tier.label}
            </button>
          ))}
        </div>
        {selectedTierInfo && (
          <p className="text-xs text-muted-foreground mt-1.5 italic">
            {selectedTierInfo.description}
          </p>
        )}
      </div>

      {/* Bathrooms */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Bathrooms</p>
        <div className="flex flex-wrap gap-1.5">
          {BATHROOM_OPTIONS.map((b) => (
            <button key={b} onClick={() => setBathroomCount(b)} className={pillClass(bathroomCount === b)}>
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Parking */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Parking included?</span>
        <div className="flex gap-1.5">
          {[true, false].map((v) => (
            <button key={String(v)} onClick={() => setHasParking(v)} className={smallPillClass(hasParking === v)}>
              {v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>

      {/* Analyse button */}
      <Button onClick={handleAnalyse} disabled={loading} className="w-full">
        {loading ? 'Estimating...' : 'Estimate Value'}
      </Button>

      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      {/* --- Results --- */}
      {result && (
        <div className="space-y-4">
          {/* Estimated value hero */}
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">Estimated value</p>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(result.estimated_value)}</p>
            <p className="text-xs text-muted-foreground">
              {shortCurrency(result.band_low)} – {shortCurrency(result.band_high)}
            </p>
          </div>

          {/* Band gauge */}
          <PriceBandGauge
            bandLow={result.band_low}
            bandHigh={result.band_high}
            bandLowOuter={result.band_low_outer}
            bandHighOuter={result.band_high_outer}
            askingPrice={result.asking_price}
            estimatedValue={result.estimated_value}
          />

          {/* Asking price verdict */}
          {vc && result.asking_price && (
            <div className={`rounded-lg border p-3 ${vc.bg} ${vc.border}`}>
              <p className={`text-sm font-semibold ${vc.color}`}>{vc.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.asking_diff_pct !== null && (
                  <>
                    {Math.abs(result.asking_diff_pct)}%{' '}
                    {result.asking_diff_pct > 0 ? 'above' : 'below'} our estimate of{' '}
                    {formatCurrency(result.estimated_value)}
                  </>
                )}
              </p>
            </div>
          )}

          {/* Methodology steps (top N free) */}
          {visibleSteps.length > 0 && (
            <div>
              <button
                onClick={() => setShowMethodology(!showMethodology)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1.5 hover:text-foreground transition-colors"
              >
                How we estimated this
                {showMethodology ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showMethodology && (
                <div className="space-y-1.5">
                  {visibleSteps.map((step) => (
                    <MethodologyRow key={step.step} step={step} />
                  ))}
                  {hiddenStepCount > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      {hiddenStepCount} more step{hiddenStepCount > 1 ? 's' : ''} in full report
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Hazard cost flags (always shown free — consumer advocate) */}
          {result.hazard_cost_flags.length > 0 && (
            <HazardCostFlags flags={result.hazard_cost_flags} />
          )}

          {/* Property adjustments (top N free) */}
          {visibleAdj.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Property adjustments:
              </p>
              <div className="space-y-1.5">
                {visibleAdj.map((adj) => (
                  <AdjustmentRow key={adj.factor} adj={adj} />
                ))}
              </div>
              {hiddenAdjCount > 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {hiddenAdjCount} more factor{hiddenAdjCount > 1 ? 's' : ''} in full report
                </p>
              )}
            </div>
          )}

          {/* Ownership costs preview */}
          <OwnershipCostsSummary costs={result.ownership_costs} isMultiUnit={result.is_multi_unit} />

          {/* Premium CTA */}
          <button
            onClick={() => {
              useDownloadGateStore.getState().setShowUpgradeModal(true, 'price-advisor', {}, addressId, 'buyer');
            }}
            className="w-full rounded-lg border border-dashed border-piq-primary/30 bg-piq-primary/5 p-3 text-center space-y-1.5 hover:bg-piq-primary/10 transition-colors cursor-pointer"
          >
            <p className="text-xs font-medium text-piq-primary">
              Full breakdown in your report
            </p>
            <p className="text-xs text-muted-foreground">
              Full methodology · all adjustments · hazard cost analysis · ownership costs · area context
            </p>
          </button>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{result.sa2_name}</span>
            <span className="text-[9px]">CV + HPI + bond data</span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function MethodologyRow({ step }: { step: PriceMethodologyStep }) {
  const shortCurrency = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    return `$${Math.round(v / 1000)}K`;
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-piq-primary/10 text-piq-primary text-xs font-semibold flex items-center justify-center shrink-0">
        {step.step}
      </span>
      <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
        {step.label}
      </span>
      <span className="text-xs font-semibold tabular-nums shrink-0">
        {shortCurrency(step.value)}
      </span>
    </div>
  );
}

function HazardCostFlags({ flags }: { flags: HazardCostFlag[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-risk-high" />
        <span className="text-xs font-medium text-muted-foreground">Ownership risk flags</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {flags.map((f) => (
          <span
            key={f.hazard}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-risk-high/10 text-risk-high border border-risk-high/20"
            title={f.description}
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            {f.label}
            {(f.insurance_uplift_pct_low > 0 || f.insurance_uplift_pct_high > 0) && (
              <span className="opacity-70">
                +{f.insurance_uplift_pct_low}–{f.insurance_uplift_pct_high}% insurance
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function AdjustmentRow({ adj }: { adj: PriceAdjustment }) {
  const isNegative = adj.pct_high < 0;
  const maxMagnitude = Math.max(Math.abs(adj.pct_low), Math.abs(adj.pct_high));
  const barPct = Math.min(100, (maxMagnitude / 15) * 100);

  const shortDollar = (v: number) => {
    const abs = Math.abs(v);
    const sign = v >= 0 ? '+' : '-';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    return `${sign}$${Math.round(abs / 1000)}K`;
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isNegative ? 'bg-piq-accent-warm' : 'bg-piq-success'}`} />
      <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
        {adj.label}
        <span className="opacity-60 ml-1">({adj.reason})</span>
      </span>
      <div className="w-12 h-2 rounded-full bg-muted/40 overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isNegative ? 'bg-piq-accent-warm' : 'bg-piq-success'}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums w-14 text-right shrink-0 ${isNegative ? 'text-piq-accent-warm' : 'text-piq-success'}`}>
        {shortDollar(adj.dollar_low)} to {shortDollar(adj.dollar_high)}
      </span>
    </div>
  );
}

function OwnershipCostsSummary({ costs, isMultiUnit }: { costs: OwnershipCosts; isMultiUnit: boolean }) {
  const totalLow = (costs.rates_annual || 0) + costs.insurance_annual_low + (isMultiUnit ? (costs.body_corp_annual || 0) : 0);
  const totalHigh = (costs.rates_annual || 0) + costs.insurance_annual_high + (isMultiUnit ? (costs.body_corp_annual || 0) : 0);

  const shortAnnual = (v: number) => `$${Math.round(v).toLocaleString('en-NZ')}/yr`;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Estimated annual costs</p>
      <dl className="space-y-1">
        {costs.rates_annual !== null && (
          <div className="flex justify-between text-xs">
            <dt className="text-muted-foreground">Council rates</dt>
            <dd className="font-medium tabular-nums">{shortAnnual(costs.rates_annual)}</dd>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <dt className="text-muted-foreground">Insurance</dt>
          <dd className="font-medium tabular-nums">
            {costs.insurance_annual_low === costs.insurance_annual_high
              ? shortAnnual(costs.insurance_annual_low)
              : `${shortAnnual(costs.insurance_annual_low)}–${shortAnnual(costs.insurance_annual_high)}`
            }
          </dd>
        </div>
        {isMultiUnit && costs.body_corp_annual && (
          <div className="flex justify-between text-xs">
            <dt className="text-muted-foreground">Body corp (est.)</dt>
            <dd className="font-medium tabular-nums">{shortAnnual(costs.body_corp_annual)}</dd>
          </div>
        )}
        <div className="border-t border-border pt-1 flex justify-between text-xs">
          <dt className="font-medium">Total</dt>
          <dd className="font-semibold tabular-nums">
            {totalLow === totalHigh
              ? shortAnnual(totalLow)
              : `${shortAnnual(totalLow)}–${shortAnnual(totalHigh)}`
            }
          </dd>
        </div>
      </dl>
    </div>
  );
}
