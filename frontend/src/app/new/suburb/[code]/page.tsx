'use client';

import { use } from 'react';
import { SuburbSummaryPage } from '@/components/suburb/SuburbSummaryPage';
import { ErrorState } from '@/components/common/ErrorState';
import { AppHeaderNew } from '@/components/new/AppHeaderNew';

export default function NewSuburbPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  if (!code || !/^\d{4,6}$/.test(code)) {
    return (
      <>
        <AppHeaderNew />
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 56px)' }} data-ws-new-wrapper="suburb">
          <ErrorState variant="suburb-not-found" />
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeaderNew />
      <div data-ws-new-wrapper="suburb" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <SuburbSummaryPage sa2Code={code} />
      </div>
    </>
  );
}
