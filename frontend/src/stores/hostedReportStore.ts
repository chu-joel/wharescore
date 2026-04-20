import { create } from 'zustand';
import type { ReportSnapshot, RentBaseline, DeltaEntry } from '@/lib/types';

interface HostedReportState {
  // User-adjustable inputs
  bedrooms: string;
  bathrooms: string;
  finishTier: string;
  weeklyRent: number | null;
  askingPrice: number | null;
  // Toggles
  hasParking: boolean | null;
  isFurnished: boolean | null;
  isPartiallyFurnished: boolean;
  notInsulated: boolean;
  sharedKitchen: boolean | null;
  utilitiesIncluded: boolean | null;
  hasOutdoorSpace: boolean;
  isCharacterProperty: boolean;

  // Setters
  setBedrooms: (v: string) => void;
  setBathrooms: (v: string) => void;
  setFinishTier: (v: string) => void;
  setWeeklyRent: (v: number | null) => void;
  setAskingPrice: (v: number | null) => void;
  setHasParking: (v: boolean | null) => void;
  setIsFurnished: (v: boolean | null) => void;
  setIsPartiallyFurnished: (v: boolean) => void;
  setNotInsulated: (v: boolean) => void;
  setSharedKitchen: (v: boolean | null) => void;
  setUtilitiesIncluded: (v: boolean | null) => void;
  setHasOutdoorSpace: (v: boolean) => void;
  setIsCharacterProperty: (v: boolean) => void;

  // Initialize from snapshot defaults
  initFromSnapshot: (meta: ReportSnapshot['meta']) => void;
}

export const useHostedReportStore = create<HostedReportState>()((set) => ({
  bedrooms: '2',
  bathrooms: '1',
  finishTier: 'modern',
  weeklyRent: null,
  askingPrice: null,
  hasParking: null,
  isFurnished: null,
  isPartiallyFurnished: false,
  notInsulated: false,
  sharedKitchen: null,
  utilitiesIncluded: null,
  hasOutdoorSpace: false,
  isCharacterProperty: false,

  setBedrooms: (bedrooms) => set({ bedrooms }),
  setBathrooms: (bathrooms) => set({ bathrooms }),
  setFinishTier: (finishTier) => set({ finishTier }),
  setWeeklyRent: (weeklyRent) => set({ weeklyRent }),
  setAskingPrice: (askingPrice) => set({ askingPrice }),
  setHasParking: (hasParking) => set({ hasParking }),
  setIsFurnished: (isFurnished) => set({ isFurnished }),
  setIsPartiallyFurnished: (isPartiallyFurnished) => set({ isPartiallyFurnished }),
  setNotInsulated: (notInsulated) => set({ notInsulated }),
  setSharedKitchen: (sharedKitchen) => set({ sharedKitchen }),
  setUtilitiesIncluded: (utilitiesIncluded) => set({ utilitiesIncluded }),
  setHasOutdoorSpace: (hasOutdoorSpace) => set({ hasOutdoorSpace }),
  setIsCharacterProperty: (isCharacterProperty) => set({ isCharacterProperty }),

  initFromSnapshot: (meta) => {
    const inputs = meta.inputs_at_purchase || {};
    set({
      bedrooms: (inputs.bedrooms as string) || '2',
      bathrooms: (inputs.bathrooms as string) || '1',
      finishTier: (inputs.finish_tier as string) || 'modern',
      weeklyRent: (inputs.weekly_rent as number) || null,
      askingPrice: (inputs.asking_price as number) || null,
    });
  },
}));

/**
 * Compute the current rent band from snapshot data + user inputs.
 * All client-side. no API calls.
 */
export function computeRentBand(
  snapshot: ReportSnapshot,
  state: Pick<HostedReportState, 'bedrooms' | 'bathrooms' | 'finishTier' | 'weeklyRent' | 'hasParking' | 'isFurnished' | 'isPartiallyFurnished' | 'notInsulated' | 'sharedKitchen' | 'utilitiesIncluded' | 'hasOutdoorSpace' | 'isCharacterProperty'>,
): {
  baseline: RentBaseline | null;
  bandLow: number;
  bandHigh: number;
  bandLowOuter: number;
  bandHighOuter: number;
  verdict: string | null;
  diffPct: number | null;
  appliedDeltas: Array<{ label: string; pctLow: number; pctHigh: number }>;
} {
  const key = `${snapshot.meta.dwelling_type}:${state.bedrooms}`;
  const baseline = snapshot.rent_baselines[key] ?? null;

  if (!baseline) {
    return { baseline: null, bandLow: 0, bandHigh: 0, bandLowOuter: 0, bandHighOuter: 0, verdict: null, diffPct: null, appliedDeltas: [] };
  }

  // Start with the baseline band (already includes hazard + location + size + quality adjustments)
  let productLow = 1.0;
  let productHigh = 1.0;
  const appliedDeltas: Array<{ label: string; pctLow: number; pctHigh: number }> = [];

  const applyDelta = (key: string, label: string, table: Record<string, DeltaEntry>) => {
    const delta = table[key];
    if (delta && (Math.abs(delta.pct_low) >= 0.5 || Math.abs(delta.pct_high) >= 0.5)) {
      productLow *= 1 + delta.pct_low / 100;
      productHigh *= 1 + delta.pct_high / 100;
      appliedDeltas.push({ label, pctLow: delta.pct_low, pctHigh: delta.pct_high });
    }
  };

  // Bathrooms
  applyDelta(`${state.bedrooms}:${state.bathrooms}`, `${state.bathrooms} bathroom${state.bathrooms !== '1' ? 's' : ''}`, snapshot.deltas.bathroom_deltas);

  // Finish tier
  applyDelta(state.finishTier, `${state.finishTier.charAt(0).toUpperCase() + state.finishTier.slice(1)} finish`, snapshot.deltas.finish_deltas);

  // Toggles
  if (state.hasParking === true) applyDelta('parking_yes', 'Parking included', snapshot.deltas.toggle_deltas);
  if (state.hasParking === false) applyDelta('parking_no', 'No parking', snapshot.deltas.toggle_deltas);
  if (state.isPartiallyFurnished) applyDelta('partially_furnished', 'Partially furnished', snapshot.deltas.toggle_deltas);
  else if (state.isFurnished === true) applyDelta('furnished', 'Furnished', snapshot.deltas.toggle_deltas);
  else if (state.isFurnished === false) applyDelta('unfurnished', 'Unfurnished', snapshot.deltas.toggle_deltas);
  if (state.notInsulated) applyDelta('not_insulated', 'Not insulated', snapshot.deltas.toggle_deltas);
  if (state.sharedKitchen === true) applyDelta('shared_kitchen', 'Shared kitchen', snapshot.deltas.toggle_deltas);
  if (state.utilitiesIncluded === true) applyDelta('utilities_included', 'Utilities included', snapshot.deltas.toggle_deltas);
  if (state.hasOutdoorSpace) applyDelta('outdoor_space', 'Outdoor space', snapshot.deltas.toggle_deltas);
  if (state.isCharacterProperty) applyDelta('character_property', 'Character property', snapshot.deltas.toggle_deltas);

  // Apply deltas to baseline band
  const rawLow = baseline.band_low * Math.min(productLow, productHigh);
  const rawHigh = baseline.band_high * Math.max(productLow, productHigh);
  const bandLow = Math.round(rawLow);
  const bandHigh = Math.round(rawHigh);
  const bandLowOuter = Math.round(bandLow * 0.97);
  const bandHighOuter = Math.round(bandHigh * 1.03);

  // Verdict
  let verdict: string | null = null;
  let diffPct: number | null = null;
  if (state.weeklyRent) {
    const rent = state.weeklyRent;
    if (rent < bandLow) {
      verdict = 'below-market';
      diffPct = -Math.round(((bandLow - rent) / bandLow) * 100 * 10) / 10;
    } else if (rent <= bandHigh) {
      verdict = 'fair';
      const mid = (bandLow + bandHigh) / 2;
      diffPct = Math.round(((rent - mid) / mid) * 100 * 10) / 10;
    } else {
      const abovePct = ((rent - bandHigh) / bandHigh) * 100;
      diffPct = Math.round(abovePct * 10) / 10;
      if (abovePct <= 10) verdict = 'slightly-high';
      else if (abovePct <= 20) verdict = 'high';
      else verdict = 'very-high';
    }
  }

  return { baseline, bandLow, bandHigh, bandLowOuter, bandHighOuter, verdict, diffPct, appliedDeltas };
}
