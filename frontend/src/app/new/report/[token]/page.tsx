'use client';

import { use } from 'react';
import { Loader2 } from 'lucide-react';
import { useReportSnapshot } from '@/hooks/useReportSnapshot';
import { ErrorState } from '@/components/common/ErrorState';
import { HostedReport } from '@/components/report/HostedReport';
import { HostedQuickReport } from '@/components/report/HostedQuickReport';
import { AppHeaderNew } from '@/components/new/AppHeaderNew';

export default function NewHostedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: snapshot, isLoading, error } = useReportSnapshot(token);

  if (isLoading) {
    return (
      <>
        <AppHeaderNew />
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
          <div style={{ textAlign: 'center', display: 'grid', gap: 8, color: 'var(--ws-ink-mute)' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--ws-piq)' }} />
            <span style={{ fontSize: 13 }}>Loading your report&hellip;</span>
          </div>
        </div>
      </>
    );
  }

  if (error || !snapshot) {
    return (
      <>
        <AppHeaderNew />
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 56px)', padding: 24 }}>
          <ErrorState variant="not-found" message="This report link may have expired or is invalid." />
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeaderNew />
      <div data-ws-new-wrapper="hosted">
        {snapshot.report_tier === 'quick'
          ? <HostedQuickReport snapshot={snapshot} token={token} />
          : <HostedReport snapshot={snapshot} token={token} />
        }
      </div>
    </>
  );
}
