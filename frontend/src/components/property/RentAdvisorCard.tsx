'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useRentInputStore } from '@/stores/rentInputStore';
import { apiFetch } from '@/lib/api';
import type { RentAdvisorResult } from '@/lib/types';

interface RentAdvisorCardProps {
  addressId: number;
}

type FinishTier = 'basic' | 'standard' | 'modern' | 'premium' | 'luxury';
type Bathrooms = '1' | '2' | '3+';

const FINISH_TIERS: { value: FinishTier; label: string; description: string }[] = [
  { value: 'basic', label: 'Basic', description: 'Dated kitchen/bathroom, older carpets, basic fittings. Functional but showing age.' },
  { value: 'standard', label: 'Standard', description: 'Clean and tidy, no frills. Standard fittings, adequate storage.' },
  { value: 'modern', label: 'Modern', description: 'Recently renovated or built. Good fixtures, modern kitchen/bathroom.' },
  { value: 'premium', label: 'Premium', description: 'High-end finishes, designer kitchen, quality materials throughout.' },
  { value: 'luxury', label: 'Luxury', description: 'Architect-designed, top-of-the-line appliances, exceptional fit-out.' },
];

const BATHROOM_OPTIONS: Bathrooms[] = ['1', '2', '3+'];

const VERDICT_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  'below-market': { icon: '✓', label: 'Your rent looks below market', color: 'text-piq-success' },
  'fair': { icon: '✓', label: 'Your rent looks fair', color: 'text-piq-success' },
  'slightly-high': { icon: '~', label: 'Your rent is slightly high', color: 'text-yellow-600' },
  'high': { icon: '!', label: 'Your rent is high', color: 'text-risk-high' },
  'very-high': { icon: '!!', label: 'Your rent is very high', color: 'text-risk-high' },
};

export function RentAdvisorCard({ addressId }: RentAdvisorCardProps) {
  const { dwellingType, bedrooms, weeklyRent } = useRentInputStore();

  const [expanded, setExpanded] = useState(false);
  const [finishTier, setFinishTier] = useState<FinishTier | null>(null);
  const [bathroomCount, setBathroomCount] = useState<Bathrooms | null>(null);
  const [hasParking, setHasParking] = useState<boolean | null>(null);
  const [hasInsulation, setHasInsulation] = useState<boolean | null>(null);
  const [result, setResult] = useState<RentAdvisorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show if user has completed rent comparison
  if (!dwellingType || !bedrooms || !weeklyRent) return null;

  const selectedTierInfo = FINISH_TIERS.find((t) => t.value === finishTier);

  const handleAnalyse = useCallback(async () => {
    if (!dwellingType || !bedrooms || !weeklyRent) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        dwelling_type: dwellingType,
        bedrooms,
        weekly_rent: weeklyRent,
      };
      if (finishTier) body.finish_tier = finishTier;
      if (bathroomCount) body.bathrooms = bathroomCount;
      if (hasParking !== null) body.has_parking = hasParking;
      if (hasInsulation !== null) body.has_insulation = hasInsulation;

      const data = await apiFetch<RentAdvisorResult>(
        `/api/v1/property/${addressId}/rent-advisor`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      );
      setResult(data);
    } catch {
      setError('Could not analyse rent. Try again.');
    } finally {
      setLoading(false);
    }
  }, [addressId, dwellingType, bedrooms, weeklyRent, finishTier, bathroomCount, hasParking, hasInsulation]);

  const verdictConfig = result ? VERDICT_CONFIG[result.verdict] : null;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      {/* Expand header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3.5 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm font-semibold">Get personalised rent advice</span>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-4">
          {/* Finish tier picker */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">How would you describe this property?</p>
            <div className="flex flex-wrap gap-1.5">
              {FINISH_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  onClick={() => setFinishTier(tier.value)}
                  className={`rounded-full h-8 px-3 text-xs font-medium border transition-colors ${
                    finishTier === tier.value
                      ? 'bg-piq-primary text-white border-piq-primary'
                      : 'border-piq-primary text-piq-primary hover:bg-piq-primary/5'
                  }`}
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
                <button
                  key={b}
                  onClick={() => setBathroomCount(b)}
                  className={`rounded-full h-8 px-3 text-xs font-medium border transition-colors ${
                    bathroomCount === b
                      ? 'bg-piq-primary text-white border-piq-primary'
                      : 'border-piq-primary text-piq-primary hover:bg-piq-primary/5'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Parking toggle (flats/apartments only) */}
          {(dwellingType === 'Flat' || dwellingType === 'Apartment') && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Parking included?</span>
              <div className="flex gap-1.5">
                {[
                  { value: true, label: 'Yes' },
                  { value: false, label: 'No' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setHasParking(opt.value)}
                    className={`rounded-full h-7 px-3 text-xs font-medium border transition-colors ${
                      hasParking === opt.value
                        ? 'bg-piq-primary text-white border-piq-primary'
                        : 'border-piq-primary text-piq-primary hover:bg-piq-primary/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Insulation toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Insulated?</span>
            <div className="flex gap-1.5">
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setHasInsulation(opt.value)}
                  className={`rounded-full h-7 px-3 text-xs font-medium border transition-colors ${
                    hasInsulation === opt.value
                      ? 'bg-piq-primary text-white border-piq-primary'
                      : 'border-piq-primary text-piq-primary hover:bg-piq-primary/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Analyse button */}
          <Button onClick={handleAnalyse} disabled={loading} className="w-full">
            {loading ? 'Analysing...' : 'Analyse My Rent'}
          </Button>

          {error && <p className="text-xs text-destructive text-center">{error}</p>}

          {/* Results */}
          {result && verdictConfig && (
            <div className="space-y-3">
              {/* Verdict banner */}
              <div className={`rounded-lg border p-3 ${
                result.verdict === 'fair' || result.verdict === 'below-market'
                  ? 'border-piq-success/30 bg-piq-success/5'
                  : result.verdict === 'slightly-high'
                    ? 'border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/5'
                    : 'border-risk-high/30 bg-red-50 dark:bg-risk-high/5'
              }`}>
                <p className={`text-sm font-semibold ${verdictConfig.color}`}>
                  {verdictConfig.icon} {verdictConfig.label}
                </p>
                <p className="text-sm mt-1">
                  ${result.your_rent}/wk vs adjusted estimate ${result.adjusted_median}/wk
                </p>
                <p className="text-xs text-muted-foreground">
                  ({result.difference_pct > 0 ? '+' : ''}{result.difference_pct}% {result.difference_pct >= 0 ? 'above' : 'below'} estimate)
                </p>
              </div>

              {/* Adjustment breakdown */}
              {result.adjustments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">How we calculated this:</p>
                  <div className="text-xs space-y-1 pl-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SA2 median</span>
                      <span className="tabular-nums font-medium">${result.raw_median}/wk</span>
                    </div>
                    {result.adjustments.map((adj) => (
                      <div key={adj.factor} className="flex justify-between">
                        <span className="text-muted-foreground">
                          {adj.pct >= 0 ? '+' : ''}{adj.pct}% {adj.label.toLowerCase()} ({adj.reason})
                        </span>
                        <span className="tabular-nums font-medium">
                          {adj.dollar >= 0 ? '+' : ''}${adj.dollar}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-border pt-1 font-medium">
                      <span>Adjusted estimate</span>
                      <span className="tabular-nums">${result.adjusted_median}/wk</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Advice lines */}
              {result.advice_lines.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {result.advice_lines.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                <span className="shrink-0">i</span>
                <span>{result.disclaimer}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
