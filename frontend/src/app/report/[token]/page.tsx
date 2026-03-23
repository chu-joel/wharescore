'use client';

import { use } from 'react';
import { HostedReport } from '@/components/report/HostedReport';
import { useReportSnapshot } from '@/hooks/useReportSnapshot';
import { Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/common/ErrorState';

export default function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: snapshot, isLoading, error } = useReportSnapshot(token);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-piq-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your report...</p>
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <ErrorState
          variant="not-found"
          message="This report link may have expired or is invalid."
        />
      </div>
    );
  }

  return <HostedReport snapshot={snapshot} token={token} />;
}
