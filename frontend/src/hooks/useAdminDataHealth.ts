import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface DataHealthResponse {
  tables: Record<string, number | 'error'>;
  services: Record<string, boolean>;
}

export function useAdminDataHealth() {
  return useQuery({
    queryKey: ['admin', 'data-health'],
    queryFn: () => apiFetch<DataHealthResponse>('/api/v1/admin/data-health'),
    staleTime: 60_000,
  });
}
