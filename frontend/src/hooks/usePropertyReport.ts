import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PropertyReport } from '@/lib/types';
import { transformReport } from '@/lib/transformReport';

export function usePropertyReport(addressId: number | null) {
  return useQuery({
    queryKey: ['property-report', addressId],
    queryFn: async (): Promise<PropertyReport> => {
      const raw = await apiFetch<unknown>(`/api/v1/property/${addressId}/report`);
      return transformReport(raw);
    },
    enabled: addressId !== null,
    staleTime: 5 * 60 * 1000,
  });
}
