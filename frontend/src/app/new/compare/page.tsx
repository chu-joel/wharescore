'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CompareView } from '@/components/compare/CompareView';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useStoreHydrated } from '@/hooks/useStoreHydrated';
import { AppHeaderNew } from '@/components/new/AppHeaderNew';

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0).slice(0, 3);
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const stagedItems = useComparisonStore((s) => s.items);
  const mounted = useStoreHydrated();
  const { status } = useSession();
  const idsFromUrl = useMemo(() => parseIds(params.get('ids')), [params]);

  useEffect(() => {
    if (!mounted || status === 'loading') return;
    if (idsFromUrl.length > 0 && stagedItems.length === 0 && status === 'authenticated') {
      router.replace('/new/compare');
    }
  }, [mounted, status, idsFromUrl, stagedItems.length, router]);

  const ids = idsFromUrl.length > 0 ? idsFromUrl : stagedItems.map((i) => i.addressId);
  return <CompareView addressIds={ids} />;
}

export default function NewComparePage() {
  return (
    <>
      <AppHeaderNew />
      <div data-ws-new-wrapper="compare" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <Suspense fallback={null}><Inner /></Suspense>
      </div>
    </>
  );
}
