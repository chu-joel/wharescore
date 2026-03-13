import { create } from 'zustand';

interface SelectedAddress {
  addressId: number;
  fullAddress: string;
  lng: number;
  lat: number;
}

interface SearchState {
  query: string;
  isOverlayOpen: boolean;
  selectedAddress: SelectedAddress | null;
  setQuery: (q: string) => void;
  openOverlay: () => void;
  closeOverlay: () => void;
  selectAddress: (addr: SelectedAddress) => void;
  clearSelection: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  isOverlayOpen: false,
  selectedAddress: null,
  setQuery: (query) => set({ query }),
  openOverlay: () => set({ isOverlayOpen: true }),
  closeOverlay: () => set({ isOverlayOpen: false, query: '' }),
  selectAddress: (addr) => set({ selectedAddress: addr, isOverlayOpen: false, query: '' }),
  clearSelection: () => set({ selectedAddress: null, query: '' }),
}));
