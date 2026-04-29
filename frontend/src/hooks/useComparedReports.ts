import { useQueries } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { transformReport } from '@/lib/transformReport';
import type { PropertyReport } from '@/lib/types';

/**
 * Hydrate N reports in parallel, mirroring `usePropertyReport`'s two-phase
 * fetch:
 *
 *  1. ?fast=true — renders immediately. Skips Valhalla terrain + walking
 *     reach (~1-3s vs 5-15s for full).
 *  2. full       — silently upgrades each report once fast has landed.
 *     Adds terrain, walking_reach_10min, full event history etc.
 *
 * The compare page consumes whichever data is currently available per id.
 * That means rows like "10-min walk reach" appear as `unknown` for a few
 * seconds and then resolve, rather than staying blank for the entire
 * session.
 */
export function useComparedReports(addressIds: number[]) {
  const fastQueries = useQueries({
    queries: addressIds.map((id) => ({
      queryKey: ['property-report', id, 'fast'] as const,
      queryFn: async (): Promise<PropertyReport> => {
        const raw = await apiFetch<unknown>(`/api/v1/property/${id}/report?fast=true`);
        return transformReport(raw);
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  const fullQueries = useQueries({
    queries: addressIds.map((id, idx) => ({
      queryKey: ['property-report', id] as const,
      queryFn: async (): Promise<PropertyReport> => {
        const raw = await apiFetch<unknown>(`/api/v1/property/${id}/report`);
        return transformReport(raw);
      },
      // Only start the full request after fast has resolved — same
      // connection-budgeting rule as usePropertyReport.
      enabled: !!fastQueries[idx]?.data,
      staleTime: 5 * 60 * 1000,
    })),
  });

  // Use full data when available; fall back to fast while terrain loads.
  const reports = addressIds.map(
    (_, idx) => fullQueries[idx]?.data ?? fastQueries[idx]?.data ?? null,
  );

  return {
    reports,
    loading: fastQueries.some((q) => q.isLoading),
    enriching: fullQueries.some(
      (q, idx) => !!fastQueries[idx]?.data && q.isLoading,
    ),
    errors: fastQueries.map((q, idx) => q.error ?? fullQueries[idx]?.error ?? null),
    isAnyReady: reports.some((r) => r != null),
    isAllReady: reports.every((r) => r != null),
  };
}
