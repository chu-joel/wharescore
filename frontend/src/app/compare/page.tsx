'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CompareView } from '@/components/compare/CompareView';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useStoreHydrated } from '@/hooks/useStoreHydrated';

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 3);
}

function ComparePageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const stagedItems = useComparisonStore((s) => s.items);
  const mounted = useStoreHydrated();
  const { status: sessionStatus } = useSession();

  const idsFromUrl = useMemo(
    () => parseIds(params.get('ids')),
    [params],
  );

  // If URL is empty, fall back to whatever's staged. Lets users open /compare
  // directly from the tray's "Compare now" button without re-encoding ids.
  const effectiveIds =
    idsFromUrl.length > 0
      ? idsFromUrl
      : mounted
        ? stagedItems.map((i) => i.addressId)
        : [];

  // Auth gate — comparison requires sign-in (matches the 2nd-add gate on
  // AddToCompareButton). Lets the user share a /compare URL but anyone
  // anonymous gets routed through /signin first and lands back here.
  useEffect(() => {
    if (sessionStatus === 'unauthenticated' && effectiveIds.length >= 2) {
      const callback = `/compare?ids=${effectiveIds.join(',')}`;
      router.replace(`/signin?callbackUrl=${encodeURIComponent(callback)}`);
    }
  }, [sessionStatus, effectiveIds, router]);

  // With fewer than 2 properties there's nothing to compare. Bounce to the
  // map view — the tray persists, so a single staged property is still
  // visible there and the user can pick a partner from the map.
  useEffect(() => {
    if (mounted && effectiveIds.length < 2) {
      router.replace('/');
    }
  }, [mounted, effectiveIds.length, router]);

  if (
    !mounted ||
    effectiveIds.length < 2 ||
    sessionStatus === 'loading' ||
    sessionStatus === 'unauthenticated'
  ) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <CompareView addressIds={effectiveIds} />;
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <ComparePageInner />
    </Suspense>
  );
}
