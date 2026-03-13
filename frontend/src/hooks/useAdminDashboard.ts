import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface DashboardStats {
  rent_reports_24h: number;
  rent_reports_7d: number;
  rent_reports_30d: number;
  feedback_7d: number;
  total_email_signups: number;
  unresolved_feedback: number;
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => apiFetch<DashboardStats>('/api/v1/admin/dashboard'),
    refetchInterval: 30_000,
  });
}
