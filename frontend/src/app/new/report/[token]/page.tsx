'use client';

import { use } from 'react';
import { Loader2 } from 'lucide-react';
import { useReportSnapshot } from '@/hooks/useReportSnapshot';
import { ErrorState } from '@/components/common/ErrorState';
import { HostedReportShell } from '@/components/new/HostedReportShell';
import { HostedReportNew } from '@/components/new/HostedReportNew';
import { HostedQuickReportNew } from '@/components/new/HostedQuickReportNew';

export default function NewHostedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: snapshot, isLoading, error } = useReportSnapshot(token);

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
        <div style={{ textAlign: 'center', display: 'grid', gap: 8, color: 'var(--ws-ink-mute)' }}>
          <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--ws-piq)' }} />
          <span style={{ fontSize: 13 }}>Loading your report&hellip;</span>
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 56px)', padding: 24 }}>
        <ErrorState variant="not-found" message="This report link may have expired or is invalid." />
      </div>
    );
  }

  const variant = snapshot.report_tier === 'quick' ? 'quick' : 'full';

  return (
    <HostedReportShell snapshot={snapshot} token={token} variant={variant}>
      {variant === 'quick'
        ? <HostedQuickReportNew snapshot={snapshot} token={token} />
        : <HostedReportNew snapshot={snapshot} token={token} />}
    </HostedReportShell>
  );
}
