import { useState, useCallback } from 'react';
import { readJSON, writeJSON } from '@/lib/storage';
import { MAX_RECENT_SEARCHES } from '@/lib/constants';

interface RecentSearch {
  addressId: number;
  fullAddress: string;
  score: number | null;
  rating: string | null;
  lng?: number;
  lat?: number;
  timestamp: number;
}

export function useRecentSearches() {
  const [items, setItems] = useState<RecentSearch[]>(() => {
    const raw = readJSON<RecentSearch[]>('recent_searches', []);
    return raw
      .filter(
        (r) => typeof r.addressId === 'number' && typeof r.fullAddress === 'string'
      )
      .slice(0, MAX_RECENT_SEARCHES);
  });

  const add = useCallback((search: Omit<RecentSearch, 'timestamp'>) => {
    setItems((prev) => {
      const filtered = prev.filter((r) => r.addressId !== search.addressId);
      const next = [{ ...search, timestamp: Date.now() }, ...filtered].slice(
        0,
        MAX_RECENT_SEARCHES
      );
      writeJSON('recent_searches', next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    writeJSON('recent_searches', []);
  }, []);

  return { items, add, clearAll };
}
