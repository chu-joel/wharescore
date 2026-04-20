import { useState, useCallback, useEffect } from 'react';
import { readJSON, writeJSON } from '@/lib/storage';
import { MAX_SAVED_PROPERTIES } from '@/lib/constants';

export const SAVED_PROPERTIES_KEY = 'saved_properties';
const LEGACY_KEY = 'wharescore_saved';

export interface SavedProperty {
  addressId: number;
  fullAddress: string;
  score: number | null;
  rating: string | null;
  isMultiUnit: boolean;
  lng?: number;
  lat?: number;
  savedAt: number;
}

/**
 * One-time silent migration from the legacy `wharescore_saved` key
 * (used by the old SavePropertyButton, which stored only addressIds)
 * into the canonical `saved_properties` key (SavedProperty objects).
 * The old saves come across with placeholder fullAddress; viewing
 * the property re-enriches it. Safe to run multiple times.
 */
function migrateLegacySaves(): void {
  if (typeof window === 'undefined') return;
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (!legacyRaw) return;
  try {
    const legacyIds = JSON.parse(legacyRaw);
    if (Array.isArray(legacyIds) && legacyIds.length > 0) {
      const current = readJSON<SavedProperty[]>(SAVED_PROPERTIES_KEY, []);
      const existing = new Set(current.map((p) => p.addressId));
      const migrated = legacyIds
        .filter((id: unknown): id is number => typeof id === 'number')
        .filter((id: number) => !existing.has(id))
        .map((id: number) => ({
          addressId: id,
          fullAddress: 'Saved property',
          score: null,
          rating: null,
          isMultiUnit: false,
          savedAt: Date.now(),
        }));
      if (migrated.length > 0) {
        writeJSON(SAVED_PROPERTIES_KEY, [...migrated, ...current].slice(0, MAX_SAVED_PROPERTIES));
      }
    }
  } catch {
    // Legacy key was corrupt; drop it below.
  }
  localStorage.removeItem(LEGACY_KEY);
}

export function useSavedProperties() {
  const [items, setItems] = useState<SavedProperty[]>(() => {
    migrateLegacySaves();
    const raw = readJSON<SavedProperty[]>(SAVED_PROPERTIES_KEY, []);
    return raw
      .filter(
        (r) => typeof r.addressId === 'number' && typeof r.fullAddress === 'string'
      )
      .slice(0, MAX_SAVED_PROPERTIES);
  });

  // Cross-instance sync — when one SavePropertyButton writes, any
  // other useSavedProperties consumer (e.g. the SavedProperties
  // panel on the landing page) picks it up on the next event tick.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      setItems(readJSON<SavedProperty[]>(SAVED_PROPERTIES_KEY, []));
    };
    window.addEventListener('storage', handler);
    window.addEventListener('saved-properties-updated', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('saved-properties-updated', handler);
    };
  }, []);

  const notifyUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('saved-properties-updated'));
    }
  };

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
        writeJSON(SAVED_PROPERTIES_KEY, next);
        notifyUpdated();
        return next;
      });
    },
    []
  );

  const remove = useCallback((addressId: number) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.addressId !== addressId);
      writeJSON(SAVED_PROPERTIES_KEY, next);
      notifyUpdated();
      return next;
    });
  }, []);

  /**
   * Merge a batch of server-side saves into the local list without
   * duplicating. Used after sign-in when we pull the user's saved
   * properties from the backend and want to surface any that were
   * saved on a different device. Preserves local items' metadata
   * (score/rating/lng/lat) when both sides have the same addressId.
   */
  const mergeFromServer = useCallback(
    (
      serverItems: { addressId: number; fullAddress: string; savedAt: number }[]
    ) => {
      setItems((prev) => {
        const byId = new Map(prev.map((p) => [p.addressId, p]));
        for (const s of serverItems) {
          if (!byId.has(s.addressId)) {
            byId.set(s.addressId, {
              addressId: s.addressId,
              fullAddress: s.fullAddress || 'Saved property',
              score: null,
              rating: null,
              isMultiUnit: false,
              savedAt: s.savedAt,
            });
          }
        }
        const next = Array.from(byId.values())
          .sort((a, b) => b.savedAt - a.savedAt)
          .slice(0, MAX_SAVED_PROPERTIES);
        writeJSON(SAVED_PROPERTIES_KEY, next);
        notifyUpdated();
        return next;
      });
    },
    []
  );

  const isSaved = useCallback(
    (addressId: number) => items.some((p) => p.addressId === addressId),
    [items]
  );

  return { items, toggle, remove, isSaved, mergeFromServer };
}
