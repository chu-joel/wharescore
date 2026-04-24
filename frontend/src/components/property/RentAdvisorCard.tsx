'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RentBandGauge } from './RentBandGauge';
import { useRentInputStore } from '@/stores/rentInputStore';
import { apiFetch } from '@/lib/api';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import type { RentAdvisorResult, RentAdjustment, RentAreaContext } from '@/lib/types';

interface RentAdvisorCardProps {
  addressId: number;
}

type FinishTier = 'basic' | 'standard' | 'modern' | 'premium' | 'luxury';
type Bathrooms = '1' | '2' | '3' | '4+';

const FINISH_TIERS: { value: FinishTier; label: string; description: string }[] = [
  { value: 'basic', label: 'Basic', description: 'Dated kitchen/bathroom, older carpets, basic fittings.' },
  { value: 'standard', label: 'Standard', description: 'Clean and tidy, no frills. Standard fittings.' },
  { value: 'modern', label: 'Modern', description: 'Recently renovated or built. Good fixtures.' },
  { value: 'premium', label: 'Premium', description: 'High-end finishes, designer kitchen, quality materials.' },
  { value: 'luxury', label: 'Luxury', description: 'Architect-designed, top-of-the-line appliances.' },
];

const BATHROOM_OPTIONS: Bathrooms[] = ['1', '2', '3', '4+'];

const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'below-market': {
    label: 'Your rent looks below market',
    color: 'text-piq-success',
    bg: 'bg-piq-success/5',
    border: 'border-piq-success/30',
  },
  'fair': {
    label: 'Your rent looks fair',
    color: 'text-piq-success',
    bg: 'bg-piq-success/5',
    border: 'border-piq-success/30',
  },
  'slightly-high': {
    label: 'Your rent is slightly high',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 dark:bg-yellow-500/5',
    border: 'border-yellow-500/30',
  },
  'high': {
    label: 'Your rent is high',
    color: 'text-risk-high',
    bg: 'bg-red-50 dark:bg-risk-high/5',
    border: 'border-risk-high/30',
  },
  'very-high': {
    label: 'Your rent is very high',
    color: 'text-risk-high',
    bg: 'bg-red-50 dark:bg-risk-high/5',
    border: 'border-risk-high/30',
  },
};

// Pill button shared style
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

// Max visible adjustments in free tier
const FREE_ADJUSTMENT_LIMIT = 2;

export function RentAdvisorCard({ addressId }: RentAdvisorCardProps) {
  const dwellingType = useRentInputStore((s) => s.dwellingType);
  const bedrooms = useRentInputStore((s) => s.bedrooms);
  const weeklyRent = useRentInputStore((s) => s.weeklyRent);
  const finishTier = useRentInputStore((s) => s.finishTier) as FinishTier | null;
  const bathroomCount = useRentInputStore((s) => s.bathrooms) as Bathrooms | null;
  const hasParking = useRentInputStore((s) => s.hasParking);
  const notInsulated = useRentInputStore((s) => s.notInsulated);
  const isFurnished = useRentInputStore((s) => s.isFurnished);
  const isPartiallyFurnished = useRentInputStore((s) => s.isPartiallyFurnished);
  const hasOutdoorSpace = useRentInputStore((s) => s.hasOutdoorSpace);
  const isCharacterProperty = useRentInputStore((s) => s.isCharacterProperty);
  const sharedKitchen = useRentInputStore((s) => s.sharedKitchen);
  const utilitiesIncluded = useRentInputStore((s) => s.utilitiesIncluded);
  const setFinishTier = useRentInputStore((s) => s.setFinishTier);
  const setBathroomCount = useRentInputStore((s) => s.setBathrooms);
  const setHasParking = useRentInputStore((s) => s.setHasParking);
  const setNotInsulated = useRentInputStore((s) => s.setNotInsulated);
  const setIsFurnished = useRentInputStore((s) => s.setIsFurnished);
  const setIsPartiallyFurnished = useRentInputStore((s) => s.setIsPartiallyFurnished);
  const setHasOutdoorSpace = useRentInputStore((s) => s.setHasOutdoorSpace);
  const setIsCharacterProperty = useRentInputStore((s) => s.setIsCharacterProperty);
  const setSharedKitchen = useRentInputStore((s) => s.setSharedKitchen);
  const setUtilitiesIncluded = useRentInputStore((s) => s.setUtilitiesIncluded);

  const [result, setResult] = useState<RentAdvisorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (notInsulated) body.has_insulation = false;
      if (isPartiallyFurnished) body.is_partially_furnished = true;
      else if (isFurnished !== null) body.is_furnished = isFurnished;
      if (hasOutdoorSpace) body.has_outdoor_space = true;
      if (isCharacterProperty) body.is_character_property = true;
      if (sharedKitchen !== null) body.shared_kitchen = sharedKitchen;
      if (utilitiesIncluded !== null) body.utilities_included = utilitiesIncluded;

      const data = await apiFetch<RentAdvisorResult>(
        `/api/v1/property/${addressId}/rent-advisor`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      setResult(data);

      // Also persist the richer details to /rent-reports so community
      // averages benefit from the bathroom/finish/parking/furnishing
      // context, not just raw rent. Backend upserts within 24h so this
      // enriches the row already written by RentComparisonFlow rather
      // than creating a duplicate. Data collection is covered by the
      // first-visit RentDataNotice banner — no per-form opt-in.
      const bondBedrooms = bedrooms === 'Studio' ? '1' : bedrooms;
      const reportBody: Record<string, unknown> = {
        address_id: addressId,
        dwelling_type: dwellingType,
        bedrooms: bondBedrooms,
        reported_rent: weeklyRent,
        source_context: 'rent_advisor_card',
        notice_version:
          typeof window !== 'undefined' &&
          window.localStorage?.getItem('analytics_consent') === 'true'
            ? 'combined_v1'
            : null,
      };
      if (bathroomCount) reportBody.bathrooms = bathroomCount;
      if (finishTier) reportBody.finish_tier = finishTier;
      if (hasParking !== null) reportBody.has_parking = hasParking;
      if (isFurnished !== null) reportBody.is_furnished = isFurnished;
      if (isPartiallyFurnished !== null) reportBody.is_partially_furnished = isPartiallyFurnished;
      if (hasOutdoorSpace !== null) reportBody.has_outdoor_space = hasOutdoorSpace;
      if (isCharacterProperty !== null) reportBody.is_character_property = isCharacterProperty;
      if (sharedKitchen !== null) reportBody.shared_kitchen = sharedKitchen;
      if (utilitiesIncluded !== null) reportBody.utilities_included = utilitiesIncluded;
      if (notInsulated !== null) reportBody.not_insulated = notInsulated;
      apiFetch('/api/v1/rent-reports', {
        method: 'POST',
        body: JSON.stringify(reportBody),
      }).catch(() => {
        // Non-fatal. User got their rent advice; the enrichment can miss.
      });
    } catch {
      setError('Could not analyse rent. Try again.');
    } finally {
      setLoading(false);
    }
  }, [addressId, dwellingType, bedrooms, weeklyRent, finishTier, bathroomCount, hasParking, notInsulated, isFurnished, isPartiallyFurnished, hasOutdoorSpace, isCharacterProperty, sharedKitchen, utilitiesIncluded]);

  // Only show if user has selected dwelling type and bedrooms
  if (!dwellingType || !bedrooms) return null;

  const canAnalyse = !!weeklyRent;

  const vc = result ? VERDICT_CONFIG[result.verdict] : null;

  // Split adjustments for free/paid display
  const visibleAdj = result?.adjustments.slice(0, FREE_ADJUSTMENT_LIMIT) ?? [];
  const hiddenCount = Math.max(0, (result?.adjustments.length ?? 0) - FREE_ADJUSTMENT_LIMIT);

  return (
    <div className="rounded-xl border border-border bg-card card-elevated p-3.5 space-y-4">
      {/* Header */}
      <span className="text-sm font-semibold">Is my rent fair?</span>

      {/* --- Inputs --- */}

      {/* Finish tier */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">How would you describe this property?</p>
            <div className="flex flex-wrap gap-1.5">
              {FINISH_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  onClick={() => setFinishTier(tier.value)}
                  className={pillClass(finishTier === tier.value)}
                  title={tier.description}
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

          {/* Parking (flats/apartments) */}
          {(dwellingType === 'Flat' || dwellingType === 'Apartment') && (
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
          )}

          {/* Furnished */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Furnishing?</span>
            <div className="flex gap-1.5">
              <button onClick={() => { setIsFurnished(true); setIsPartiallyFurnished(null); }} className={smallPillClass(isFurnished === true && !isPartiallyFurnished)}>
                Furnished
              </button>
              <button onClick={() => { setIsPartiallyFurnished(true); setIsFurnished(null); }} className={smallPillClass(!!isPartiallyFurnished)}>
                Partial
              </button>
              <button onClick={() => { setIsFurnished(false); setIsPartiallyFurnished(null); }} className={smallPillClass(isFurnished === false && !isPartiallyFurnished)}>
                Unfurnished
              </button>
            </div>
          </div>

          {/* Private outdoor space */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Private outdoor space?</span>
            <div className="flex gap-1.5">
              {([true, false] as const).map((v) => (
                <button key={String(v)} onClick={() => setHasOutdoorSpace(v)} className={smallPillClass(hasOutdoorSpace === v)}>
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {/* Character property */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Character / unique design?</span>
            <div className="flex gap-1.5">
              {([true, false] as const).map((v) => (
                <button key={String(v)} onClick={() => setIsCharacterProperty(v)} className={smallPillClass(isCharacterProperty === v)}>
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {/* Shared kitchen (rooms/flats/apartments) */}
          {(dwellingType === 'Room' || dwellingType === 'Flat' || dwellingType === 'Apartment') && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Shared kitchen?</span>
              <div className="flex gap-1.5">
                {([true, false] as const).map((v) => (
                  <button key={String(v)} onClick={() => setSharedKitchen(v)} className={smallPillClass(sharedKitchen === v)}>
                    {v ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Utilities included */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Utilities included in rent?</span>
            <div className="flex gap-1.5">
              {([true, false] as const).map((v) => (
                <button key={String(v)} onClick={() => setUtilitiesIncluded(v)} className={smallPillClass(utilitiesIncluded === v)}>
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {/* Insulation. checkbox warning flag, not a toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notInsulated}
              onChange={(e) => setNotInsulated(e.target.checked)}
              className="rounded border-risk-high/50 text-risk-high focus:ring-risk-high"
            />
            <span className="text-xs text-muted-foreground">
              Property is <span className="font-medium text-risk-high">not insulated</span>
              <span className="text-xs opacity-70 ml-1">(required by Healthy Homes Standards)</span>
            </span>
          </label>

          {/* Analyse button */}
          <Button onClick={handleAnalyse} disabled={loading || !canAnalyse} className="w-full">
            {loading ? 'Analysing...' : !canAnalyse ? 'Enter your rent to analyse' : 'Analyse My Rent'}
          </Button>

          {error && <p className="text-xs text-destructive text-center">{error}</p>}

          {/* --- Results --- */}
          {result && vc && (
            <div className="space-y-4">
              {/* Band gauge */}
              <RentBandGauge
                bandLow={result.band_low}
                bandHigh={result.band_high}
                bandLowOuter={result.band_low_outer}
                bandHighOuter={result.band_high_outer}
                userRent={result.your_rent}
                rawMedian={result.raw_median}
              />

              {/* Verdict banner */}
              <div className={`rounded-lg border p-3 ${vc.bg} ${vc.border}`}>
                <p className={`text-sm font-semibold ${vc.color}`}>
                  {vc.label}
                </p>
                {result.verdict === 'below-market' ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ${result.band_low - result.your_rent}–${result.band_high - result.your_rent}/wk below the
                    estimated fair range of ${result.band_low}–${result.band_high}/wk
                  </p>
                ) : result.verdict === 'fair' ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Within the estimated fair range of ${result.band_low}–${result.band_high}/wk
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ${result.your_rent - result.band_high}–${result.your_rent - result.band_low}/wk above the
                    estimated fair range of ${result.band_low}–${result.band_high}/wk
                  </p>
                )}
              </div>

              {/* Hazard flags (always shown free) */}
              <HazardFlags adjustments={result.adjustments} />

              {/* Adjustments breakdown (top N free) */}
              {visibleAdj.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Adjustments applied to your property:
                  </p>
                  <div className="space-y-1.5">
                    {visibleAdj.map((adj) => (
                      <AdjustmentRow key={adj.factor} adj={adj} median={result.raw_median} />
                    ))}
                  </div>
                  {hiddenCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {hiddenCount} more factor{hiddenCount > 1 ? 's' : ''} in full report
                    </p>
                  )}
                </div>
              )}

              {/* Premium CTA. area context, full breakdown, advice in the report */}
              <button
                onClick={() => {
                  useDownloadGateStore.getState().setShowUpgradeModal(true, 'rent-advisor', {}, addressId, 'renter');
                }}
                className="w-full rounded-lg border border-dashed border-piq-primary/30 bg-piq-primary/5 p-3 text-center space-y-1.5 hover:bg-piq-primary/10 transition-colors cursor-pointer"
              >
                <p className="text-xs font-medium text-piq-primary">
                  Full breakdown in your report
                </p>
                <p className="text-xs text-muted-foreground">
                  All {result.factors_analysed} factors · area context · negotiation advice · insurance flags
                </p>
              </button>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{result.bond_count} bonds · {result.sa2_name}</span>
                <span className="text-[9px]">MBIE bond data + council records</span>
              </div>
            </div>
          )}
    </div>
  );
}

// --- Sub-components ---

function HazardFlags({ adjustments }: { adjustments: RentAdjustment[] }) {
  const hazards = adjustments.filter((a) => a.category === 'hazard');
  if (hazards.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {hazards.map((h) => (
        <span
          key={h.factor}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-risk-high/10 text-risk-high border border-risk-high/20"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          {h.label}
          {h.prevalence_pct !== undefined && h.prevalence_pct > 0 && (
            <span className="opacity-70">({h.prevalence_pct}% of area)</span>
          )}
        </span>
      ))}
    </div>
  );
}

function AdjustmentRow({ adj, median }: { adj: RentAdjustment; median: number }) {
  const isNegative = adj.pct_high < 0;
  const maxMagnitude = Math.max(Math.abs(adj.pct_low), Math.abs(adj.pct_high));
  // Bar width relative to max possible (20%)
  const barPct = Math.min(100, (maxMagnitude / 15) * 100);

  return (
    <div className="flex items-center gap-2">
      {/* Factor dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          adj.category === 'hazard'
            ? 'bg-risk-high'
            : adj.category === 'location'
              ? isNegative ? 'bg-piq-accent-warm' : 'bg-blue-500'
              : isNegative
                ? 'bg-piq-accent-warm'
                : 'bg-piq-success'
        }`}
      />
      {/* Label + reason */}
      <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
        {adj.label}
        <span className="opacity-60 ml-1">({adj.reason})</span>
      </span>
      {/* Mini bar */}
      <div className="w-12 h-2 rounded-full bg-muted/40 overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            adj.category === 'hazard'
              ? 'bg-risk-high'
              : adj.category === 'location'
                ? isNegative ? 'bg-piq-accent-warm' : 'bg-blue-500'
                : isNegative
                  ? 'bg-piq-accent-warm'
                  : 'bg-piq-success'
          }`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      {/* Range */}
      <span className="text-xs tabular-nums font-medium text-right w-[70px] shrink-0">
        {adj.pct_low === adj.pct_high
          ? `${adj.pct_low > 0 ? '+' : ''}${adj.pct_low}%`
          : `${adj.pct_low > 0 ? '+' : ''}${adj.pct_low} to ${adj.pct_high > 0 ? '+' : ''}${adj.pct_high}%`}
      </span>
    </div>
  );
}

function AreaContextRow({ ctx }: { ctx: RentAreaContext }) {
  const barPct = ctx.max_scale > 0 ? Math.min(100, (ctx.value / ctx.max_scale) * 100) : 50;
  const isHazard = ctx.is_area_wide_hazard;

  return (
    <div className="flex items-center gap-2">
      {/* Direction arrow */}
      <span className={`text-xs w-3 text-center shrink-0 ${
        isHazard ? 'text-risk-high' :
        ctx.direction === 'up' ? 'text-piq-success' :
        ctx.direction === 'down' ? 'text-piq-accent-warm' :
        'text-muted-foreground'
      }`}>
        {isHazard ? '⚠' : ctx.direction === 'up' ? '↑' : ctx.direction === 'down' ? '↓' : '–'}
      </span>
      {/* Label */}
      <span className="text-xs text-muted-foreground w-16 shrink-0">{ctx.label}</span>
      {/* Bar */}
      <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isHazard ? 'bg-risk-high/60' :
            ctx.direction === 'up' ? 'bg-piq-success/60' :
            ctx.direction === 'down' ? 'bg-piq-accent-warm/60' :
            'bg-muted-foreground/40'
          }`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      {/* Description */}
      <span className="text-xs text-muted-foreground shrink-0 max-w-[140px] truncate">
        {ctx.description}
      </span>
    </div>
  );
}
