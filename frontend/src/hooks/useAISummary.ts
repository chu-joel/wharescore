import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

interface AISummaryResponse {
  ai_summary: string | null;
  area_profile: string | null;
}

export function useAISummary(addressId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['ai-summary', addressId],
    queryFn: () => apiFetch<AISummaryResponse>(`/api/v1/property/${addressId}/ai-summary`),
    enabled: addressId !== null && enabled,
    staleTime: 24 * 60 * 60 * 1000, // 24h. same as backend cache
    retry: false,
  });
}
