import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';

export interface RecommendationRule {
  id: string;
  severity: string;
  title: string;
  category: string;
  disabled: boolean;
  severity_override: string | null;
  title_override: string | null;
  extra_actions: string[];
  actions_override: string[] | null;
  default_actions: string[];
  placeholders: string[];
}

export interface RecommendationsResponse {
  rules: RecommendationRule[];
}

export function useAdminRecommendations() {
  const { getToken } = useAuthToken();
  return useQuery({
    queryKey: ['admin', 'recommendations'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<RecommendationsResponse>('/api/v1/admin/recommendations', { token: token ?? undefined });
    },
  });
}

export function useUpdateRecommendations() {
  const queryClient = useQueryClient();
  const { getToken } = useAuthToken();

  return useMutation({
    mutationFn: async (overrides: Record<string, unknown>) => {
      const token = await getToken();
      return apiFetch('/api/v1/admin/content/recommendations', {
        method: 'PUT',
        body: JSON.stringify({ overrides }),
        token: token ?? undefined,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'recommendations'] }),
  });
}
