import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ComparisonItem {
  addressId: number;
  fullAddress: string;
  suburb: string;
  city: string;
  lat: number;
  lng: number;
  addedAt: number;
}

export const COMPARE_MAX_ANONYMOUS = 2;
export const COMPARE_MAX_SIGNED_IN = 3;

interface ComparisonState {
  items: ComparisonItem[];
  add: (item: Omit<ComparisonItem, 'addedAt'>) => { ok: boolean; reason?: 'duplicate' | 'cap' };
  remove: (addressId: number) => void;
  clear: () => void;
  isStaged: (addressId: number) => boolean;
  // Replace the current list (used by sign-in merge in Phase B).
  replaceAll: (items: ComparisonItem[]) => void;
}

export const useComparisonStore = create<ComparisonState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const { items } = get();
        if (items.some((i) => i.addressId === item.addressId)) {
          return { ok: false, reason: 'duplicate' };
        }
        if (items.length >= COMPARE_MAX_ANONYMOUS) {
          return { ok: false, reason: 'cap' };
        }
        set({ items: [...items, { ...item, addedAt: Date.now() }] });
        return { ok: true };
      },
      remove: (addressId) =>
        set({ items: get().items.filter((i) => i.addressId !== addressId) }),
      clear: () => set({ items: [] }),
      isStaged: (addressId) => get().items.some((i) => i.addressId === addressId),
      replaceAll: (items) => set({ items }),
    }),
    {
      name: 'wharescore-comparison',
      version: 1,
    },
  ),
);
