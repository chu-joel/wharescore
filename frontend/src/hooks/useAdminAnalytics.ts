import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';

export interface AnalyticsOverview {
  today: {
    searches: number;
    report_views: number;
    reports_generated: number;
    payments: number;
    active_sessions: number;
    total_requests: number;
    avg_response_ms: number;
    server_errors: number;
    errors: number;
  };
  trends: Record<string, { day: string; value: number }[]>;
  top_endpoints: {
    endpoint: string;
    count: number;
    avg_ms: number;
    p95_ms: number;
  }[];
  slow_requests: {
    path: string;
    duration_ms: number;
    method: string;
    status_code: number;
    created_at: string;
    request_id: string;
  }[];
  recent_errors: {
    id: number;
    category: string;
    level: string;
    message: string;
    path: string;
    created_at: string;
    resolved_at: string | null;
  }[];
  unresolved_errors_24h: number;
  visitors: {
    /** Daily active visitors (distinct ip_hash, today) */
    dau: number;
    /** Weekly active visitors (last 7 days) */
    wau: number;
    /** Monthly active visitors (last 30 days) */
    mau: number;
    /** Visitors today whose first-ever event was today */
    new_today: number;
    /** Visitors today who had prior events before today */
    returning_today: number;
  };
  funnel: {
    /** Window in days the funnel covers */
    days: number;
    stages: {
      name: string;
      count: number;
      /** Percentage of the top stage (always 100 for the first stage) */
      pct: number;
    }[];
  };
}

export function useAdminAnalytics(days = 7) {
  const { getToken } = useAuthToken();
  return useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<AnalyticsOverview>(`/api/v1/admin/analytics/overview?days=${days}`, { token: token ?? undefined });
    },
    refetchInterval: 30_000,
  });
}
