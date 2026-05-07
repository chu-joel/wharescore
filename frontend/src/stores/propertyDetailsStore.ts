// Shared property descriptors that drive both the renter (rent fairness)
// and the buyer (price advisor, investment metrics) flows. Surfaced via the
// PropertyDetailsChip at the top of the report and reused by sub-flows
// (RentComparisonFlow, PriceAdvisorCard) so the user never re-enters
// bedrooms / dwelling type a second time.
//
// Persisted across sessions and across addresses because most users shop
// for similar typologies; sub-flows call setIfUnset() rather than blindly
// overwriting so a user editing a 3-bed flat after looking at a 2-bed
// apartment still sees their last choice as the default until they say
// otherwise.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DwellingType = 'House' | 'Apartment' | 'Flat' | 'Boarding House' | 'Room';
export const DWELLING_TYPES: DwellingType[] = ['House', 'Apartment', 'Flat', 'Boarding House', 'Room'];

export type Bedrooms = '1' | '2' | '3' | '4' | '5+';
export const BEDROOM_VALUES: Bedrooms[] = ['1', '2', '3', '4', '5+'];

export type Bathrooms = '1' | '2' | '3' | '4+';
export const BATHROOM_VALUES: Bathrooms[] = ['1', '2', '3', '4+'];

export type FinishTier = 'basic' | 'standard' | 'modern' | 'premium' | 'luxury';
export const FINISH_TIERS: FinishTier[] = ['basic', 'standard', 'modern', 'premium', 'luxury'];

interface PropertyDetailsState {
  dwellingType: DwellingType | null;
  bedrooms: Bedrooms | null;
  bathrooms: Bathrooms | null;
  finishTier: FinishTier | null;
  hasParking: boolean | null;
  /** Whether the user has explicitly dismissed the chip on this property report. */
  chipDismissed: boolean;
  setDwellingType: (v: DwellingType | null) => void;
  setBedrooms: (v: Bedrooms | null) => void;
  setBathrooms: (v: Bathrooms | null) => void;
  setFinishTier: (v: FinishTier | null) => void;
  setHasParking: (v: boolean | null) => void;
  setChipDismissed: (v: boolean) => void;
  /** Used by sub-flows to back-fill defaults without overwriting user choices. */
  hydrateDefaults: (defaults: {
    dwellingType?: DwellingType | null;
    bedrooms?: Bedrooms | null;
    bathrooms?: Bathrooms | null;
    finishTier?: FinishTier | null;
  }) => void;
}

export const usePropertyDetailsStore = create<PropertyDetailsState>()(
  persist(
    (set, get) => ({
      dwellingType: null,
      bedrooms: null,
      bathrooms: null,
      finishTier: null,
      hasParking: null,
      chipDismissed: false,
      setDwellingType: (dwellingType) => set({ dwellingType }),
      setBedrooms: (bedrooms) => set({ bedrooms }),
      setBathrooms: (bathrooms) => set({ bathrooms }),
      setFinishTier: (finishTier) => set({ finishTier }),
      setHasParking: (hasParking) => set({ hasParking }),
      setChipDismissed: (chipDismissed) => set({ chipDismissed }),
      hydrateDefaults: (defaults) => {
        const s = get();
        const next: Partial<PropertyDetailsState> = {};
        if (s.dwellingType == null && defaults.dwellingType) next.dwellingType = defaults.dwellingType;
        if (s.bedrooms == null && defaults.bedrooms) next.bedrooms = defaults.bedrooms;
        if (s.bathrooms == null && defaults.bathrooms) next.bathrooms = defaults.bathrooms;
        if (s.finishTier == null && defaults.finishTier) next.finishTier = defaults.finishTier;
        if (Object.keys(next).length > 0) set(next);
      },
    }),
    {
      name: 'wharescore-property-details',
      // Don't persist the dismissal flag — chipDismissed should reset on a
      // fresh session so users discover the chip again on a new property.
      partialize: (s) => ({
        dwellingType: s.dwellingType,
        bedrooms: s.bedrooms,
        bathrooms: s.bathrooms,
        finishTier: s.finishTier,
        hasParking: s.hasParking,
      }),
    },
  ),
);
