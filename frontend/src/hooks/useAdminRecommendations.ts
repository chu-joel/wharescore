import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

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
  return useQuery({
    queryKey: ['admin', 'recommendations'],
    queryFn: () =>
      apiFetch<RecommendationsResponse>('/api/v1/admin/recommendations'),
  });
}

export function useUpdateRecommendations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (overrides: Record<string, unknown>) =>
      apiFetch('/api/v1/admin/content/recommendations', {
        method: 'PUT',
        body: JSON.stringify({ overrides }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'recommendations'] }),
  });
}
