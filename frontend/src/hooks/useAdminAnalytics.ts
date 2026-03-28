import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

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
}

export function useAdminAnalytics(days = 7) {
  return useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => apiFetch<AnalyticsOverview>(`/api/v1/admin/analytics/overview?days=${days}`),
    refetchInterval: 30_000,
  });
}
