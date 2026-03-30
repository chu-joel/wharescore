'use client';

import { useState } from 'react';
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';
import {
  Search, Eye, FileText, CreditCard, Users, Activity,
  AlertTriangle, Clock, CheckCircle, XCircle,
} from 'lucide-react';

const TIME_RANGES = [
  { label: 'Today', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

function StatCard({
  label, value, icon: Icon, sub, alert,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <Card className={`p-4 ${alert ? 'border-red-500/50 bg-red-50 dark:bg-red-950/20' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-md p-2 ${alert ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted'}`}>
          <Icon className={`h-5 w-5 ${alert ? 'text-red-500' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function Sparkline({ data, height = 32, width = 120 }: { data: number[]; height?: number; width?: number }) {
  if (!data.length) return <span className="text-xs text-muted-foreground">No data</span>;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - (v / max) * (height - 4);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-primary"
      />
    </svg>
  );
}

export function AnalyticsPanel() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useAdminAnalytics(days);
  const { getToken } = useAuthToken();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { today, trends, top_endpoints, slow_requests, recent_errors, unresolved_errors_24h } = data;

  const handleResolve = async (errorId: number) => {
    const token = await getToken();
    await apiFetch(`/api/v1/admin/analytics/errors/${errorId}/resolve`, { method: 'POST', token: token ?? undefined });
  };

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Range:</span>
        {TIME_RANGES.map((r) => (
          <Button
            key={r.days}
            variant={days === r.days ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Searches" value={today.searches} icon={Search} />
        <StatCard label="Report Views" value={today.report_views} icon={Eye} />
        <StatCard label="Reports Generated" value={today.reports_generated} icon={FileText} />
        <StatCard label="Payments" value={today.payments} icon={CreditCard} />
        <StatCard label="Active Sessions" value={today.active_sessions} icon={Users} />
        <StatCard label="Requests" value={today.total_requests} icon={Activity} />
        <StatCard
          label="Avg Response"
          value={`${Math.round(today.avg_response_ms)}ms`}
          icon={Clock}
        />
        <StatCard
          label="Errors (24h)"
          value={today.errors}
          icon={AlertTriangle}
          alert={today.errors > 0}
          sub={unresolved_errors_24h > 0 ? `${unresolved_errors_24h} unresolved` : undefined}
        />
      </div>

      {/* Trend sparklines */}
      {Object.keys(trends).length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Trends ({days}d)</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(trends).map(([name, points]) => (
              <div key={name} className="flex items-center gap-3">
                <div>
                  <Sparkline data={points.map((p) => p.value)} />
                  <p className="text-xs text-muted-foreground mt-1">{name.replace(/_/g, ' ')}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top endpoints */}
      {top_endpoints.length > 0 && (
        <Card className="p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-3">Top Endpoints (24h)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Endpoint</th>
                <th className="pb-2 pr-4 text-right">Count</th>
                <th className="pb-2 pr-4 text-right">Avg</th>
                <th className="pb-2 text-right">P95</th>
              </tr>
            </thead>
            <tbody>
              {top_endpoints.map((ep) => (
                <tr key={ep.endpoint} className="border-b border-border/50">
                  <td className="py-1.5 pr-4 font-mono text-xs truncate max-w-xs">{ep.endpoint}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{ep.count}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{ep.avg_ms}ms</td>
                  <td className="py-1.5 text-right tabular-nums">{ep.p95_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Slow requests */}
      {slow_requests.length > 0 && (
        <Card className="p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-3 text-amber-600 dark:text-amber-400">
            Slow Requests (&gt;2s, 24h)
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Path</th>
                <th className="pb-2 pr-4 text-right">Duration</th>
                <th className="pb-2 pr-4">Method</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {slow_requests.map((sr, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1.5 pr-4 font-mono text-xs truncate max-w-xs">{sr.path}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums text-amber-600 dark:text-amber-400">
                    {Math.round(sr.duration_ms)}ms
                  </td>
                  <td className="py-1.5 pr-4">{sr.method}</td>
                  <td className="py-1.5 text-right">{sr.status_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Recent errors */}
      {recent_errors.length > 0 && (
        <Card className="p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-3 text-red-600 dark:text-red-400">
            Recent Errors
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Message</th>
                <th className="pb-2 pr-4">Path</th>
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {recent_errors.map((err) => (
                <tr key={err.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      err.level === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      err.level === 'error' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {err.category}
                    </span>
                  </td>
                  <td className="py-1.5 pr-4 max-w-xs truncate">{err.message}</td>
                  <td className="py-1.5 pr-4 font-mono text-xs truncate max-w-[120px]">{err.path}</td>
                  <td className="py-1.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(err.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-1.5">
                    {err.resolved_at ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <button
                        onClick={() => handleResolve(err.id)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                        title="Mark resolved"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Empty state */}
      {!top_endpoints.length && !slow_requests.length && !recent_errors.length && (
        <Card className="p-8 text-center">
          <Activity className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">
            No analytics data yet. Data will appear as users interact with the app.
          </p>
        </Card>
      )}
    </div>
  );
}
