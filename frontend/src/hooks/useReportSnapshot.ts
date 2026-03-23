import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ReportSnapshot } from '@/lib/types';

export function useReportSnapshot(token: string | null) {
  return useQuery({
    queryKey: ['report-snapshot', token],
    queryFn: () => apiFetch<ReportSnapshot>(`/api/v1/report/${token}`),
    enabled: !!token,
    staleTime: Infinity, // Snapshots are immutable — never refetch
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    retry: 1,
  });
}
