import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';

export interface DataHealthResponse {
  tables: Record<string, number | 'error'>;
  services: Record<string, boolean>;
}

export function useAdminDataHealth() {
  const { getToken } = useAuthToken();
  return useQuery({
    queryKey: ['admin', 'data-health'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<DataHealthResponse>('/api/v1/admin/data-health', { token: token ?? undefined });
    },
    staleTime: 60_000,
  });
}
