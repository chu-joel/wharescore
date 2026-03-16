'use client';

import { use } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { SuburbSummaryPage } from '@/components/suburb/SuburbSummaryPage';
import { ErrorState } from '@/components/common/ErrorState';

export default function SuburbPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  if (!code || !/^\d{4,6}$/.test(code)) {
    return (
      <>
        <AppHeader />
        <div className="pt-14 flex items-center justify-center h-screen">
          <ErrorState variant="not-found" />
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <div className="pt-14">
        <SuburbSummaryPage sa2Code={code} />
      </div>
    </>
  );
}
