'use client';

import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  MessageSquare,
  Mail,
  AlertCircle,
} from 'lucide-react';

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-muted p-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
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

export function DashboardOverview() {
  const { data, isLoading } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-16 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Rent Reports (24h)"
          value={data.rent_reports_24h}
          icon={FileText}
          sub={`${data.rent_reports_7d} this week`}
        />
        <StatCard
          label="Rent Reports (30d)"
          value={data.rent_reports_30d}
          icon={FileText}
        />
        <StatCard
          label="Feedback (7d)"
          value={data.feedback_7d}
          icon={MessageSquare}
          sub={`${data.unresolved_feedback} unresolved`}
        />
        <StatCard
          label="Email Signups"
          value={data.total_email_signups}
          icon={Mail}
        />
      </div>

      {data.unresolved_feedback > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-amber-800 dark:text-amber-200">
              {data.unresolved_feedback} unresolved feedback item
              {data.unresolved_feedback !== 1 ? 's' : ''} need attention
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
