import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';

export interface FeedbackItem {
  id: number;
  type: string;
  description: string;
  context: string | null;
  page_url: string | null;
  property_address: string | null;
  importance: string | null;
  satisfaction: number | null;
  email: string | null;
  status: string;
  created_at: string;
}

interface FeedbackListResponse {
  items: FeedbackItem[];
  total: number;
  page: number;
  limit: number;
}

export function useAdminFeedback(
  page: number,
  type?: string,
  status?: string,
) {
  const { getToken } = useAuthToken();
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '20');
  if (type) params.set('type', type);
  if (status) params.set('status', status);

  return useQuery({
    queryKey: ['admin', 'feedback', { page, type, status }],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<FeedbackListResponse>(`/api/v1/admin/feedback?${params}`, { token: token ?? undefined });
    },
  });
}

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient();
  const { getToken } = useAuthToken();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const token = await getToken();
      return apiFetch(`/api/v1/admin/feedback/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        token: token ?? undefined,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback'] }),
  });
}
