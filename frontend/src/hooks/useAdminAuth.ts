import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export function useAdminAuth() {
  const queryClient = useQueryClient();

  const session = useQuery({
    queryKey: ['admin', 'session'],
    queryFn: () => apiFetch<Record<string, unknown>>('/api/v1/admin/dashboard'),
    retry: false,
    staleTime: 60_000,
  });

  const login = useMutation({
    mutationFn: (password: string) =>
      apiFetch('/api/v1/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  const isAuthenticated = session.isSuccess;
  const isLoading = session.isLoading;

  return { isAuthenticated, isLoading, login };
}
