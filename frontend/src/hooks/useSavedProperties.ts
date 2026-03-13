import { useState, useCallback } from 'react';
import { readJSON, writeJSON } from '@/lib/storage';
import { MAX_SAVED_PROPERTIES } from '@/lib/constants';

interface SavedProperty {
  addressId: number;
  fullAddress: string;
  score: number | null;
  rating: string | null;
  isMultiUnit: boolean;
  lng?: number;
  lat?: number;
  savedAt: number;
}

export function useSavedProperties() {
  const [items, setItems] = useState<SavedProperty[]>(() => {
    const raw = readJSON<SavedProperty[]>('saved_properties', []);
    return raw
      .filter(
        (r) => typeof r.addressId === 'number' && typeof r.fullAddress === 'string'
      )
      .slice(0, MAX_SAVED_PROPERTIES);
  });

  const toggle = useCallback(
    (property: Omit<SavedProperty, 'savedAt'>) => {
      setItems((prev) => {
        const exists = prev.some((p) => p.addressId === property.addressId);
        let next: SavedProperty[];
        if (exists) {
          next = prev.filter((p) => p.addressId !== property.addressId);
        } else {
          next = [{ ...property, savedAt: Date.now() }, ...prev].slice(
            0,
            MAX_SAVED_PROPERTIES
          );
        }
        writeJSON('saved_properties', next);
        return next;
      });
    },
    []
  );

  const remove = useCallback((addressId: number) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.addressId !== addressId);
      writeJSON('saved_properties', next);
      return next;
    });
  }, []);

  const isSaved = useCallback(
    (addressId: number) => items.some((p) => p.addressId === addressId),
    [items]
  );

  return { items, toggle, remove, isSaved };
}
