import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';

export interface DashboardStats {
  rent_reports_24h: number;
  rent_reports_7d: number;
  rent_reports_30d: number;
  feedback_7d: number;
  total_email_signups: number;
  unresolved_feedback: number;
}

export function useAdminDashboard() {
  const { getToken } = useAuthToken();

  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<DashboardStats>('/api/v1/admin/dashboard', { token: token ?? undefined });
    },
    refetchInterval: 30_000,
  });
}
