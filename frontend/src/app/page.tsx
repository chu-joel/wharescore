'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSearchStore } from '@/stores/searchStore';
import { useMapStore } from '@/stores/mapStore';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { apiFetch } from '@/lib/api';
import { AppHeader } from '@/components/layout/AppHeader';
import { SplitView } from '@/components/layout/SplitView';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { TabletPanel } from '@/components/layout/TabletPanel';
import { MapContainer } from '@/components/map/MapContainer';
import { SearchBar } from '@/components/search/SearchBar';
import { RecentSearches } from '@/components/search/RecentSearches';
import { SavedProperties } from '@/components/search/SavedProperties';
import { PropertyReport } from '@/components/property/PropertyReport';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { SuburbSummaryPage } from '@/components/suburb/SuburbSummaryPage';
import { AppFooter } from '@/components/layout/AppFooter';
import { UpgradeModal } from '@/components/property/UpgradeModal';
import { ReportConfirmModal } from '@/components/property/ReportConfirmModal';
import { OnboardingTour } from '@/components/common/OnboardingTour';
import { MAX_ACTIVE_LAYERS } from '@/lib/constants';
import { toast } from 'sonner';
import {
  ShieldAlert,
  TreePine,
  TrendingUp,
  MapPin,
  Search,
  MousePointerClick,
  ChevronLeft,
} from 'lucide-react';

export default function Home() {
  const selectedAddress = useSearchStore((s) => s.selectedAddress);
  const selectedSuburb = useSearchStore((s) => s.selectedSuburb);
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const selectProperty = useMapStore((s) => s.selectProperty);
  const bp = useBreakpoint();
  const map = <MapContainer />;

  const hasSelection = !!selectedAddress || !!selectedSuburb;

  // Sync URL with selected property.
  //
  // CRITICAL: this effect must NOT strip the ?address param on the
  // first mount. The restore-from-URL effect below reads that param
  // to rehydrate the selection when the user arrives from an
  // external link (e.g. saved-properties list on /account, shared
  // deep link, browser back). If we strip here before they get to
  // read, the user bounces to a blank landing page despite having
  // clicked a property link. Gate the `else` branch behind a ref
  // so only explicit user-initiated deselection (back button,
  // "search another") clears the URL.
  const hasMountedRef = useRef(false);
  useEffect(() => {
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

  // Restore selection from URL on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addressId = params.get('address');
    if (addressId && !selectedAddress) {
      const id = Number(addressId);
      if (id > 0) {
        // Fetch summary to get address details
        apiFetch<{ address_id: number; full_address: string; suburb?: string; city?: string }>(
          `/api/v1/property/${id}/summary`
        ).then((summary) => {
          // We don't have coordinates from summary, so fetch from report
          apiFetch<{ address: { lng: number; lat: number } }>(
            `/api/v1/property/${id}/report?fast=true`
          ).then((report) => {
            const addr = report.address || {} as Record<string, number>;
            selectAddress({
              addressId: summary.address_id,
              fullAddress: summary.full_address,
              lng: addr.lng || 174.78,
              lat: addr.lat || -41.29,
            });
            selectProperty(summary.address_id, addr.lng || 174.78, addr.lat || -41.29);
          }).catch(() => {
            // Report failed — just use summary
            selectAddress({
              addressId: summary.address_id,
              fullAddress: summary.full_address,
              lng: 174.78,
              lat: -41.29,
            });
          });
        }).catch(() => {
          // Invalid address ID — clean URL
          const url = new URL(window.location.href);
          url.searchParams.delete('address');
          window.history.replaceState(null, '', url.toString());
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <AppHeader />
      <UpgradeModal />
      <ReportConfirmModal />
      <OnboardingTour />

      {bp === 'desktop' && (
        <div className="pt-14">
          <SplitView
            map={map}
            panel={
              selectedAddress ? (
                <PropertyReport addressId={selectedAddress.addressId} />
              ) : (
                <LandingPanel />
              )
            }
          />
        </div>
      )}

      {bp === 'tablet' && (
        <div className="pt-14 h-[calc(100vh-56px)]">
          <div className="relative w-full h-full">
            {map}
            {selectedAddress && (
              <TabletPanel>
                <PropertyReport addressId={selectedAddress.addressId} />
              </TabletPanel>
            )}
          </div>
        </div>
      )}

      {bp === 'mobile' && (
        <div className="pt-14 h-[calc(100vh-56px)] relative">
          {map}
          <SearchOverlay onSelect={(result) => {
            selectAddress({
              addressId: result.address_id,
              fullAddress: result.full_address,
              lng: result.lng,
              lat: result.lat,
            });
            selectProperty(result.address_id, result.lng, result.lat);
          }} />
          <MobileDrawer hasSelection={hasSelection}>
            {selectedAddress ? (
              <PropertyReport addressId={selectedAddress.addressId} />
            ) : selectedSuburb ? (
              <MobileSuburbView sa2Code={selectedSuburb.sa2Code} sa2Name={selectedSuburb.sa2Name} />
            ) : (
              <MobileLandingContent />
            )}
          </MobileDrawer>
        </div>
      )}
    </>
  );
}

/** Suburb info view inside mobile drawer */
function MobileSuburbView({ sa2Code, sa2Name }: { sa2Code: string; sa2Name: string }) {
  const clearSelection = useSearchStore((s) => s.clearSelection);

  return (
    <div className="py-2 space-y-3">
      <button
        onClick={clearSelection}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to search
      </button>
      <SuburbSummaryPage sa2Code={sa2Code} />
    </div>
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
        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
          <MousePointerClick className="h-3.5 w-3.5" />
          Or click any property on the map
        </p>
        {/* First-use demo nudge — lets non-tech users see a real report
            without having to type their address first. */}
        <DemoAddressRow />

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
            label="40+ checks, one report"
            detail="Flood, quake, noise, zoning & more"
          />
        </div>

        {/* Recent & saved */}
        <div className="w-full max-w-md mt-10 space-y-4">
          <RecentSearches />
          <SavedProperties />
        </div>

        <p className="mt-8 text-xs text-muted-foreground max-w-sm">
          Powered by 40+ official NZ government data sources. Free preview for every address.
        </p>
      </div>
      <AppFooter />
    </div>
  );
}

/**
 * Quick-pick demo addresses. Addresses are fetched from /search/address on
 * click so we don't need to hard-code internal address_ids — the button
 * runs the same search flow a user would run manually.
 */
const DEMO_ADDRESSES: { label: string; query: string }[] = [
  { label: 'Ponsonby, Auckland', query: '100 Ponsonby Road, Auckland' },
  { label: 'Wellington CBD', query: '10 Customhouse Quay, Wellington' },
  { label: 'Christchurch CBD', query: '100 Cashel Street, Christchurch' },
];

function DemoAddressRow() {
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const selectProperty = useMapStore((s) => s.selectProperty);

  const handlePick = async (query: string) => {
    try {
      const res = await apiFetch<{
        results?: { address_id: number; full_address: string; lng: number; lat: number }[];
      }>(`/api/v1/search/address?q=${encodeURIComponent(query)}`);
      const first = res.results?.[0];
      if (!first) return;
      selectAddress({
        addressId: first.address_id,
        fullAddress: first.full_address,
        lng: first.lng,
        lat: first.lat,
      });
      selectProperty(first.address_id, first.lng, first.lat);
    } catch {
      // Silent — the demo row is non-critical.
    }
  };

  return (
    <div className="w-full max-w-md mb-8 text-left">
      <p className="text-xs text-muted-foreground mb-2">Or try a sample:</p>
      <div className="flex flex-wrap gap-2">
        {DEMO_ADDRESSES.map((d) => (
          <button
            key={d.query}
            onClick={() => handlePick(d.query)}
            className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-piq-primary hover:bg-piq-primary/5 transition-colors"
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Layer groups that map to each feature chip
const CHIP_LAYER_GROUPS: Record<string, string[]> = {
  Hazards: ['flood_zones', 'liquefaction_zones', 'slope_failure_zones', 'tsunami_zones', 'coastal_erosion', 'wind_zones'],
  Schools: ['school_zones'],
  'Rent Check': [], // No map layers — informational
  'All Layers': [], // Opens layer awareness
};

/** Compact landing content for mobile bottom sheet (peek state) */
function MobileLandingContent() {
  const layers = useMapStore((s) => s.layers);
  const setLayers = useMapStore((s) => s.setLayers);
  const zoom = useMapStore((s) => s.viewport.zoom);

  const toggleGroup = useCallback(
    (groupLayers: string[]) => {
      if (groupLayers.length === 0) return;
      const allActive = groupLayers.every((id) => layers[id]);
      const updated = { ...layers };
      if (allActive) {
        for (const id of groupLayers) updated[id] = false;
      } else {
        const currentActive = Object.values(updated).filter(Boolean).length;
        let added = 0;
        let skipped = 0;
        for (const id of groupLayers) {
          if (updated[id]) continue;
          if (currentActive + added < MAX_ACTIVE_LAYERS) {
            updated[id] = true;
            added++;
          } else {
            skipped++;
          }
        }
        if (skipped > 0) {
          toast.info(`Layer limit reached (${MAX_ACTIVE_LAYERS} max). Disable some layers first.`);
        }
      }
      setLayers(updated);
    },
    [layers, setLayers],
  );

  const chips = [
    { label: 'Hazards', icon: ShieldAlert, color: 'text-risk-very-high', bg: 'bg-risk-very-high/10', activeBg: 'bg-risk-very-high/25 ring-1 ring-risk-very-high/30' },
    { label: 'Schools', icon: TreePine, color: 'text-piq-success', bg: 'bg-piq-success/10', activeBg: 'bg-piq-success/25 ring-1 ring-piq-success/30' },
    { label: 'Rent Check', icon: TrendingUp, color: 'text-piq-primary', bg: 'bg-piq-primary/10', activeBg: '' },
    { label: 'All Layers', icon: Search, color: 'text-piq-accent-warm', bg: 'bg-piq-accent-warm/10', activeBg: '' },
  ];

  return (
    <div className="py-2 space-y-3">
      {/* Search bar removed — header compact search opens fullscreen overlay */}

      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <MousePointerClick className="h-3 w-3" />
        {zoom < 11
          ? 'Zoom in closer to see properties'
          : 'Or tap a property on the map'}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {chips.map((item) => {
          const groupLayers = CHIP_LAYER_GROUPS[item.label] ?? [];
          const isActive = groupLayers.length > 0 && groupLayers.every((id) => layers[id]);
          const isInteractive = groupLayers.length > 0;

          return (
            <button
              key={item.label}
              onClick={() => isInteractive && toggleGroup(groupLayers)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                isActive ? item.activeBg : item.bg
              } ${isInteractive ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
            >
              <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Demo quick-picks so first-time mobile users have something to
          click other than the four shortcut tiles. */}
      <MobileDemoRow />

      <RecentSearches compact />
    </div>
  );
}

function MobileDemoRow() {
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const selectProperty = useMapStore((s) => s.selectProperty);

  const handlePick = async (query: string) => {
    try {
      const res = await apiFetch<{
        results?: { address_id: number; full_address: string; lng: number; lat: number }[];
      }>(`/api/v1/search/address?q=${encodeURIComponent(query)}`);
      const first = res.results?.[0];
      if (!first) return;
      selectAddress({
        addressId: first.address_id,
        fullAddress: first.full_address,
        lng: first.lng,
        lat: first.lat,
      });
      selectProperty(first.address_id, first.lng, first.lat);
    } catch {
      /* demo row is non-critical */
    }
  };

  return (
    <div className="px-1">
      <p className="text-xs text-muted-foreground mb-1.5">Or try a sample:</p>
      <div className="flex flex-wrap gap-1.5">
        {DEMO_ADDRESSES.map((d) => (
          <button
            key={d.query}
            onClick={() => handlePick(d.query)}
            className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground active:bg-piq-primary/10"
          >
            {d.label}
          </button>
        ))}
      </div>
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
