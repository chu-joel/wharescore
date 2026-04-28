import { useQueries } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { transformReport } from '@/lib/transformReport';
import type { PropertyReport } from '@/lib/types';

/**
 * Hydrate N reports in parallel using the same fetch path as usePropertyReport
 * (fast variant only — terrain etc. is not needed for compare). Reuses the
 * 24h Redis cache and existing tier gating; no new aggregate endpoint.
 */
export function useComparedReports(addressIds: number[]) {
  const queries = useQueries({
    queries: addressIds.map((id) => ({
      queryKey: ['property-report', id, 'fast'] as const,
      queryFn: async (): Promise<PropertyReport> => {
        const raw = await apiFetch<unknown>(`/api/v1/property/${id}/report?fast=true`);
        return transformReport(raw);
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  return {
    reports: queries.map((q) => q.data ?? null),
    loading: queries.some((q) => q.isLoading),
    errors: queries.map((q) => q.error ?? null),
    isAnyReady: queries.some((q) => !!q.data),
    isAllReady: queries.every((q) => !!q.data),
  };
}
