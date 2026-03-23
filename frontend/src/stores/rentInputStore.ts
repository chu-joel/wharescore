import { create } from 'zustand';

interface RentInputState {
  // Comparison flow inputs
  dwellingType: string | null;
  bedrooms: string | null;
  weeklyRent: number | null;
  // Advisor inputs
  finishTier: string | null;
  bathrooms: string | null;
  hasParking: boolean | null;
  notInsulated: boolean;
  isFurnished: boolean | null;
  isPartiallyFurnished: boolean | null;
  hasOutdoorSpace: boolean | null;
  isCharacterProperty: boolean | null;
  sharedKitchen: boolean | null;
  utilitiesIncluded: boolean | null;
  // Setters
  setDwellingType: (dt: string) => void;
  setBedrooms: (b: string) => void;
  setWeeklyRent: (r: number | null) => void;
  setFinishTier: (t: string | null) => void;
  setBathrooms: (b: string | null) => void;
  setHasParking: (p: boolean | null) => void;
  setNotInsulated: (v: boolean) => void;
  setIsFurnished: (v: boolean | null) => void;
  setIsPartiallyFurnished: (v: boolean | null) => void;
  setHasOutdoorSpace: (v: boolean | null) => void;
  setIsCharacterProperty: (v: boolean | null) => void;
  setSharedKitchen: (v: boolean | null) => void;
  setUtilitiesIncluded: (v: boolean | null) => void;
}

export const useRentInputStore = create<RentInputState>()((set) => ({
  dwellingType: null,
  bedrooms: null,
  weeklyRent: null,
  finishTier: null,
  bathrooms: null,
  hasParking: null,
  notInsulated: false,
  isFurnished: null,
  isPartiallyFurnished: null,
  hasOutdoorSpace: null,
  isCharacterProperty: null,
  sharedKitchen: null,
  utilitiesIncluded: null,
  setDwellingType: (dwellingType) => set({ dwellingType }),
  setBedrooms: (bedrooms) => set({ bedrooms }),
  setWeeklyRent: (weeklyRent) => set({ weeklyRent }),
  setFinishTier: (finishTier) => set({ finishTier }),
  setBathrooms: (bathrooms) => set({ bathrooms }),
  setHasParking: (hasParking) => set({ hasParking }),
  setNotInsulated: (notInsulated) => set({ notInsulated }),
  setIsFurnished: (isFurnished) => set({ isFurnished }),
  setIsPartiallyFurnished: (isPartiallyFurnished) => set({ isPartiallyFurnished }),
  setHasOutdoorSpace: (hasOutdoorSpace) => set({ hasOutdoorSpace }),
  setIsCharacterProperty: (isCharacterProperty) => set({ isCharacterProperty }),
  setSharedKitchen: (sharedKitchen) => set({ sharedKitchen }),
  setUtilitiesIncluded: (utilitiesIncluded) => set({ utilitiesIncluded }),
}));
