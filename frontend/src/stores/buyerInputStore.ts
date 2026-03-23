import { create } from 'zustand';

interface BuyerInputState {
  askingPrice: number | null;
  bedrooms: string | null;
  finishTier: string | null;
  bathrooms: string | null;
  hasParking: boolean | null;
  // Setters
  setAskingPrice: (p: number | null) => void;
  setBedrooms: (b: string | null) => void;
  setFinishTier: (t: string | null) => void;
  setBathrooms: (b: string | null) => void;
  setHasParking: (p: boolean | null) => void;
}

export const useBuyerInputStore = create<BuyerInputState>()((set) => ({
  askingPrice: null,
  bedrooms: null,
  finishTier: null,
  bathrooms: null,
  hasParking: null,
  setAskingPrice: (askingPrice) => set({ askingPrice }),
  setBedrooms: (bedrooms) => set({ bedrooms }),
  setFinishTier: (finishTier) => set({ finishTier }),
  setBathrooms: (bathrooms) => set({ bathrooms }),
  setHasParking: (hasParking) => set({ hasParking }),
}));
