import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type AdminContent = Record<string, unknown>;

export function useAdminContent() {
  return useQuery({
    queryKey: ['admin', 'content'],
    queryFn: () => apiFetch<AdminContent>('/api/v1/admin/content'),
  });
}

export function useUpdateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, body }: { key: string; body: unknown }) =>
      apiFetch(`/api/v1/admin/content/${key}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'content'] }),
  });
}
