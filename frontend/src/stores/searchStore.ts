import { create } from 'zustand';

interface SelectedAddress {
  addressId: number;
  fullAddress: string;
  lng: number;
  lat: number;
}

interface SelectedSuburb {
  sa2Code: string;
  sa2Name: string;
  taName: string;
  lng: number;
  lat: number;
}

interface SearchState {
  query: string;
  isOverlayOpen: boolean;
  selectedAddress: SelectedAddress | null;
  selectedSuburb: SelectedSuburb | null;
  setQuery: (q: string) => void;
  openOverlay: () => void;
  closeOverlay: () => void;
  selectAddress: (addr: SelectedAddress) => void;
  selectSuburb: (suburb: SelectedSuburb) => void;
  clearSelection: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  isOverlayOpen: false,
  selectedAddress: null,
  selectedSuburb: null,
  setQuery: (query) => set({ query }),
  openOverlay: () => set({ isOverlayOpen: true }),
  closeOverlay: () => set({ isOverlayOpen: false, query: '' }),
  selectAddress: (addr) => set({ selectedAddress: addr, selectedSuburb: null, isOverlayOpen: false, query: '' }),
  selectSuburb: (suburb) => set({ selectedSuburb: suburb, selectedAddress: null, isOverlayOpen: false, query: '' }),
  clearSelection: () => set({ selectedAddress: null, selectedSuburb: null, query: '' }),
}));
