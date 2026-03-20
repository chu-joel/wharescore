import { create } from 'zustand';

interface RentInputState {
  dwellingType: string | null;
  bedrooms: string | null;
  weeklyRent: number | null;
  setDwellingType: (dt: string) => void;
  setBedrooms: (b: string) => void;
  setWeeklyRent: (r: number | null) => void;
}

export const useRentInputStore = create<RentInputState>()((set) => ({
  dwellingType: null,
  bedrooms: null,
  weeklyRent: null,
  setDwellingType: (dwellingType) => set({ dwellingType }),
  setBedrooms: (bedrooms) => set({ bedrooms }),
  setWeeklyRent: (weeklyRent) => set({ weeklyRent }),
}));
