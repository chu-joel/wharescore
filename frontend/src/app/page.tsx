'use client';

import { useSearchStore } from '@/stores/searchStore';
import { AppHeader } from '@/components/layout/AppHeader';
import { SplitView } from '@/components/layout/SplitView';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { TabletPanel } from '@/components/layout/TabletPanel';
import { MapContainer } from '@/components/map/MapContainer';
import { SearchBar } from '@/components/search/SearchBar';
import { RecentSearches } from '@/components/search/RecentSearches';
import { SavedProperties } from '@/components/search/SavedProperties';
import { PropertyReport } from '@/components/property/PropertyReport';
import { AppFooter } from '@/components/layout/AppFooter';
import {
  ShieldAlert,
  TreePine,
  TrendingUp,
  MapPin,
  Search,
  MousePointerClick,
} from 'lucide-react';

export default function Home() {
  const selectedAddress = useSearchStore((s) => s.selectedAddress);

  return (
    <>
      <AppHeader />

      {/* Desktop: >= 1024px — SplitView with map + panel */}
      <div className="hidden lg:block pt-14">
        <SplitView
          map={<MapContainer />}
          panel={
            selectedAddress ? (
              <PropertyReport addressId={selectedAddress.addressId} />
            ) : (
              <LandingPanel />
            )
          }
        />
      </div>

      {/* Tablet: 640px - 1023px — Map with push panel */}
      <div className="hidden sm:block lg:hidden pt-14 h-[calc(100vh-56px)]">
        <div className="relative w-full h-full">
          <MapContainer />
          {selectedAddress && (
            <TabletPanel>
              <PropertyReport addressId={selectedAddress.addressId} />
            </TabletPanel>
          )}
        </div>
      </div>

      {/* Mobile: < 640px — Full map with bottom sheet */}
      <div className="sm:hidden pt-14 h-[calc(100vh-56px)] relative">
        <MapContainer />
        <MobileDrawer hasSelection={!!selectedAddress}>
          {selectedAddress ? (
            <PropertyReport addressId={selectedAddress.addressId} />
          ) : (
            <MobileLandingContent />
          )}
        </MobileDrawer>
      </div>
    </>
  );
}

/** Landing panel content for desktop (displayed in split view right panel) */
function LandingPanel() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        {/* Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-piq-primary/10 mb-4">
            <MapPin className="h-8 w-8 text-piq-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            Whare<span className="text-piq-primary">Score</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-xs mx-auto">
            Everything the listing doesn&apos;t tell you
          </p>
        </div>

        {/* Search — prominent on desktop landing */}
        <div className="w-full max-w-md mb-4">
          <SearchBar />
        </div>
        <p className="text-xs text-muted-foreground mb-8 flex items-center gap-1.5">
          <MousePointerClick className="h-3.5 w-3.5" />
          Or click any property on the map
        </p>

        {/* Feature highlights with icons */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-sm text-left">
          <FeatureChip
            icon={<ShieldAlert className="h-4 w-4 text-risk-very-high" />}
            label="Hazard exposure"
            detail="Flood, tsunami, quake risk"
          />
          <FeatureChip
            icon={<TreePine className="h-4 w-4 text-piq-success" />}
            label="Neighbourhood"
            detail="Schools, crime, amenities"
          />
          <FeatureChip
            icon={<TrendingUp className="h-4 w-4 text-piq-primary" />}
            label="Fair rent analysis"
            detail="Is your rent fair?"
          />
          <FeatureChip
            icon={<Search className="h-4 w-4 text-piq-accent-warm" />}
            label="27 data layers"
            detail="All free government data"
          />
        </div>

        {/* Recent & saved */}
        <div className="w-full max-w-md mt-10 space-y-4">
          <RecentSearches />
          <SavedProperties />
        </div>

        <p className="mt-8 text-[11px] text-muted-foreground max-w-sm">
          Powered by 12+ NZ government open data sources. Free during beta.
        </p>
      </div>
      <AppFooter />
    </div>
  );
}

/** Compact landing content for mobile bottom sheet (peek state) */
function MobileLandingContent() {
  return (
    <div className="py-2 space-y-3">
      {/* Mobile search inside bottom sheet */}
      <SearchBar />

      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <MousePointerClick className="h-3 w-3" />
        Or tap a property on the map
      </p>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Hazards', icon: ShieldAlert, color: 'text-risk-very-high', bg: 'bg-risk-very-high/10' },
          { label: 'Schools', icon: TreePine, color: 'text-piq-success', bg: 'bg-piq-success/10' },
          { label: 'Rent Check', icon: TrendingUp, color: 'text-piq-primary', bg: 'bg-piq-primary/10' },
          { label: '27 Layers', icon: Search, color: 'text-piq-accent-warm', bg: 'bg-piq-accent-warm/10' },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${item.bg}`}
          >
            <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
            <span className="text-xs font-medium">{item.label}</span>
          </div>
        ))}
      </div>

      <RecentSearches compact />
    </div>
  );
}

function FeatureChip({
  icon,
  label,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
