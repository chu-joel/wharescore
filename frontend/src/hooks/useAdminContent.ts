import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';

export type AdminContent = Record<string, unknown>;

export function useAdminContent() {
  const { getToken } = useAuthToken();
  return useQuery({
    queryKey: ['admin', 'content'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<AdminContent>('/api/v1/admin/content', { token: token ?? undefined });
    },
  });
}

export function useUpdateContent() {
  const queryClient = useQueryClient();
  const { getToken } = useAuthToken();

  return useMutation({
    mutationFn: async ({ key, body }: { key: string; body: unknown }) => {
      const token = await getToken();
      return apiFetch(`/api/v1/admin/content/${key}`, {
        method: 'PUT',
        body: JSON.stringify(body),
        token: token ?? undefined,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'content'] }),
  });
}
