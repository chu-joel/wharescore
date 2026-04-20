import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PropertyReport } from '@/lib/types';
import { transformReport } from '@/lib/transformReport';

/**
 * Progressive property report loader.
 *
 * Two-phase fetch to avoid connection congestion:
 *  1. ?fast=true . skips Valhalla terrain (~1-3s). Renders the report immediately.
 *  2. full       . only starts AFTER fast resolves, so it doesn't steal a
 *     connection slot from critical parallel requests (AI, rates, crime, tiles).
 *     Includes terrain/walking_reach (~5-15s). Silently upgrades data when ready.
 */
export function usePropertyReport(addressId: number | null) {
  const fastQuery = useQuery({
    queryKey: ['property-report', addressId, 'fast'],
    queryFn: async (): Promise<PropertyReport> => {
      const raw = await apiFetch<unknown>(`/api/v1/property/${addressId}/report?fast=true`);
      return transformReport(raw);
    },
    enabled: addressId !== null,
    staleTime: 5 * 60 * 1000,
  });

  // Only start the full request after fast has resolved. prevents the slow
  // Valhalla call from blocking a connection slot while critical data loads.
  const fullQuery = useQuery({
    queryKey: ['property-report', addressId],
    queryFn: async (): Promise<PropertyReport> => {
      const raw = await apiFetch<unknown>(`/api/v1/property/${addressId}/report`);
      return transformReport(raw);
    },
    enabled: addressId !== null && !!fastQuery.data,
    staleTime: 5 * 60 * 1000,
  });

  return {
    // Show full data when available, fall back to fast data while terrain is loading
    data: fullQuery.data ?? fastQuery.data,
    // Only block the UI until the fast response arrives
    isLoading: fastQuery.isLoading,
    // True while terrain data is still incoming (fast data shown, full not yet ready)
    isEnriching: fullQuery.isLoading && !!fastQuery.data,
    error: fastQuery.error ?? fullQuery.error,
    // Refetch both queries (used by error states)
    refetch: () => Promise.all([fastQuery.refetch(), fullQuery.refetch()]),
    // Expose individual query states for fine-grained UI if needed
    isFastReady: !!fastQuery.data,
    isFullReady: !!fullQuery.data,
  };
}
