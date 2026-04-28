'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import { SplitView } from '@/components/layout/SplitView';
import { MapContainer } from '@/components/map/MapContainer';
import { PropertyReport } from '@/components/property/PropertyReport';
import { UpgradeModal } from '@/components/property/UpgradeModal';
import { ReportConfirmModal } from '@/components/property/ReportConfirmModal';
import { ErrorState } from '@/components/common/ErrorState';
import { useTrackPageView } from '@/hooks/useTrackPageView';
import { useSearchStore } from '@/stores/searchStore';

export default function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const addressId = parseInt(id, 10);
  const router = useRouter();
  const selectedAddress = useSearchStore((s) => s.selectedAddress);

  useTrackPageView({ address_id: addressId });

  // Sync the map's clicked-address back to the URL. The page reads addressId
  // from the route param, so without this a click on another map pin would
  // update the AppHeader (which reads the store) but leave the report frozen
  // on the original property.
  useEffect(() => {
    if (
      selectedAddress &&
      Number.isFinite(selectedAddress.addressId) &&
      selectedAddress.addressId !== addressId
    ) {
      router.push(`/property/${selectedAddress.addressId}`);
    }
  }, [selectedAddress, addressId, router]);

  if (isNaN(addressId) || addressId <= 0 || !Number.isSafeInteger(addressId)) {
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

      {/* Desktop: split view */}
      <div className="hidden lg:block pt-14">
        <SplitView
          map={<MapContainer />}
          panel={<PropertyReport addressId={addressId} />}
        />
      </div>

      {/* Tablet: map above, report below */}
      <div className="hidden sm:block lg:hidden pt-14">
        <div className="h-[35vh] relative">
          <MapContainer />
        </div>
        <div className="overflow-y-auto">
          <PropertyReport addressId={addressId} />
        </div>
      </div>

      {/* Mobile: report only (map on home page) */}
      <div className="sm:hidden pt-14">
        <PropertyReport addressId={addressId} />
      </div>

      {/* Modals. rendered once regardless of layout breakpoint */}
      <UpgradeModal />
      <ReportConfirmModal />
    </>
  );
}
