import { useEffect, useState } from 'react';

/**
 * Returns false until Zustand persist stores have finished loading from localStorage.
 * Use this to delay rendering of store-dependent inputs to prevent SSR hydration mismatches.
 *
 * Zustand persist rehydrates synchronously on first client render via `onRehydrateStorage`,
 * but React SSR renders with default store values. During the brief window between hydration
 * and rehydration, inputs can appear unresponsive because React's vDOM has stale values.
 *
 * Usage:
 *   const hydrated = useStoreHydrated();
 *   if (!hydrated) return <Skeleton />;
 */
export function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
