'use client';

import { useEffect, useRef } from 'react';
import { useSearchStore } from '@/stores/searchStore';
import { useMapStore } from '@/stores/mapStore';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { apiFetch } from '@/lib/api';
import { MapContainer } from '@/components/map/MapContainer';
import { AppHeaderNew } from '@/components/new/AppHeaderNew';
import { PropertyReportNew } from '@/components/new/PropertyReportNew';
import { LandingPanelNew } from '@/components/new/LandingPanelNew';
// Conversion-critical global modals + onboarding (mirror classic app/page.tsx).
import { UpgradeModal } from '@/components/property/UpgradeModal';
import { ReportConfirmModal } from '@/components/property/ReportConfirmModal';
import { OnboardingTour } from '@/components/common/OnboardingTour';

export default function NewHome() {
  const selectedAddress = useSearchStore((s) => s.selectedAddress);
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const selectProperty = useMapStore((s) => s.selectProperty);
  const bp = useBreakpoint();

  // 1) Restore selection from URL on first mount (deep links / share / refresh).
  // Read from window.location instead of useSearchParams() to avoid the
  // Next.js requirement that useSearchParams() must be inside a <Suspense>
  // boundary during static export. Matches the pattern in classic app/page.tsx.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('address') ?? 0);
    if (id > 0 && !selectedAddress) {
      apiFetch<{ address_id: number; full_address: string }>(`/api/v1/property/${id}/summary`)
        .then((s) =>
          apiFetch<{ address: { lng: number; lat: number } }>(`/api/v1/property/${id}/report?fast=true`)
            .then((r) => {
              const lng = r.address?.lng ?? 174.78;
              const lat = r.address?.lat ?? -41.29;
              selectAddress({ addressId: s.address_id, fullAddress: s.full_address, lng, lat });
              selectProperty(s.address_id, lng, lat);
            })
            .catch(() => {
              selectAddress({ addressId: s.address_id, fullAddress: s.full_address, lng: 174.78, lat: -41.29 });
            }),
        )
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Sync URL with selected address — same gate as classic app/page.tsx so
  // the first mount can read ?address before we strip it.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedAddress) {
      const url = new URL(window.location.href);
      url.searchParams.set('address', String(selectedAddress.addressId));
      window.history.replaceState(null, '', url.toString());
    } else if (hasMountedRef.current) {
      const url = new URL(window.location.href);
      if (url.searchParams.has('address')) {
        url.searchParams.delete('address');
        window.history.replaceState(null, '', url.toString());
      }
    }
    hasMountedRef.current = true;
  }, [selectedAddress]);

  // 3) Snap mobile drawer when picking a different property (same as classic).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedAddress?.addressId) {
      window.dispatchEvent(new Event('drawer:snap-full'));
    }
  }, [selectedAddress?.addressId]);

  const map = <MapContainer />;
  const panelContent = selectedAddress
    ? <PropertyReportNew addressId={selectedAddress.addressId} />
    : <LandingPanelNew />;

  // Mounted at the page level so they're available wherever PropertyReportNew or
  // child sections trigger them via stores (downloadGateStore, reportConfirmStore).
  // Wrapped in [data-ws-new-wrapper] so the shadcn token remap reskins them.
  const globalChrome = (
    <div data-ws-new-wrapper="globals">
      <UpgradeModal />
      <ReportConfirmModal />
      <OnboardingTour />
    </div>
  );

  if (bp === 'mobile') {
    return (
      <>
        <AppHeaderNew />
        {globalChrome}
        <div style={{ height: 'calc(100vh - 56px)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0 }}>{map}</div>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            maxHeight: '70%', overflow: 'auto',
            background: 'var(--ws-bg)', borderTop: '1px solid var(--ws-rule)',
            borderRadius: '16px 16px 0 0',
          }}>
            {panelContent}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeaderNew />
      {globalChrome}
      <div style={{
        display: 'grid',
        gridTemplateColumns: bp === 'tablet' ? '1fr 460px' : '1fr 600px',
        height: 'calc(100vh - 56px)',
      }}>
        <div style={{ position: 'relative' }}>{map}</div>
        <aside style={{ overflowY: 'auto', background: 'var(--ws-bg)', borderLeft: '1px solid var(--ws-rule)' }}>
          {panelContent}
        </aside>
      </div>
    </>
  );
}
