'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Source,
  Layer,
  Marker,
  Popup,
  AttributionControl,
  ScaleControl,
} from 'react-map-gl/maplibre';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type maplibregl from 'maplibre-gl';
import { useMapStore } from '@/stores/mapStore';
import { useSearchStore } from '@/stores/searchStore';
import { TILE_LAYERS } from '@/lib/constants';
import { getLayerStyles, getTileUrl } from '@/lib/layerStyles';
import { addRiskPatterns, addLayerIcons } from '@/lib/mapStyles';
import { getBasemapStyle, SATELLITE_STYLE_IDS } from '@/lib/basemapStyles';
import { LABEL_SOURCE_ID, LABEL_TILE_URL, LABEL_LAYERS_LIGHT } from '@/lib/mapLabels';
import { TIMING } from '@/lib/animations';
import { MapLayerChipBar } from './MapLayerChipBar';
import { MapLegend } from './MapLegend';
import { MapStylePicker } from './MapStylePicker';
// MapPopup removed — click goes straight to report
import { MapControls } from './MapControls';
import { MapPin } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { usePersonaStore } from '@/stores/personaStore';
import { usePdfExportStore } from '@/stores/pdfExportStore';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { toast } from 'sonner';

interface HoverInfo {
  x: number;
  y: number;
  label: string;
  sublabel?: string;
  lines?: string[];
}

/** Extract a human-readable label from a hovered map feature */
function getFeatureLabel(feature: maplibregl.MapGeoJSONFeature): { label: string; sublabel?: string } | null {
  const p = feature.properties ?? {};
  const rawId = feature.layer.id;
  const layerId = rawId.replace(/-icon$/, '').replace(/-outline$/, '').replace(/-label$/, '');

  if (layerId === 'layer-addresses-click') {
    return p.full_address ? { label: p.full_address } : null;
  }
  if (layerId === 'layer-building_outlines') {
    const name = p.name as string | undefined;
    const use = p.use as string | undefined;
    const suburb = p.suburb_locality as string | undefined;
    if (name) {
      const sublabel = [use && use !== 'Unknown' ? use : null, suburb].filter(Boolean).join(' · ');
      return { label: name, sublabel: sublabel || undefined };
    }
    if (use && use !== 'Unknown') {
      return { label: use, sublabel: suburb };
    }
    return { label: 'Building', sublabel: suburb };
  }
  if (layerId === 'layer-parcels') {
    return p.appellation ? { label: p.appellation as string } : null;
  }
  if (layerId === 'layer-transit_stops') {
    return { label: p.stop_name as string ?? 'Transit stop', sublabel: p.route_type as string };
  }
  if (layerId === 'layer-heritage_sites') {
    return { label: p.name as string ?? 'Heritage site', sublabel: p.heritage_status as string };
  }
  if (layerId === 'layer-osm_amenities') {
    const name = p.name as string;
    const cat = p.subcategory as string ?? p.category as string;
    return { label: name ?? cat ?? 'Amenity', sublabel: name ? cat : undefined };
  }
  if (layerId === 'layer-crashes') {
    const severity = (p.crash_severity as string) ?? (p.severity as string);
    const year = p.crash_year as number | undefined;
    const sublabel = [severity, year ? `(${year})` : ''].filter(Boolean).join(' ');
    return { label: 'Crash site', sublabel: sublabel || undefined };
  }
  if (layerId === 'layer-contaminated_land') {
    return { label: p.site_name as string ?? 'Contaminated site' };
  }
  if (layerId === 'layer-infrastructure_projects') {
    return { label: p.project_name as string ?? 'Infrastructure project' };
  }
  if (layerId === 'layer-district_plan_zones') {
    return { label: p.zone_name as string ?? 'Zone' };
  }
  if (layerId === 'layer-flood_zones') {
    const title = p.title as string || p.label as string;
    return { label: 'Flood zone', sublabel: title ? `${title} — check floor level` : 'Check floor level relative to flood extent' };
  }
  if (layerId === 'layer-tsunami_zones') {
    const zc = p.zone_class as number | undefined;
    const zone = zc ? `Zone ${zc}` : undefined;
    const evac = p.evac_zone as string | undefined;
    const context = zc === 1 ? 'Highest risk — evacuate immediately' : zc === 2 ? 'Moderate risk — know your route' : 'Lower risk zone';
    return { label: 'Tsunami zone', sublabel: [zone, evac, context].filter(Boolean).join(' · ') };
  }
  if (layerId === 'layer-liquefaction_zones') {
    const liq = p.liquefaction as string;
    const context: Record<string, string> = {
      'Low': 'Minimal ground settlement expected',
      'Moderate': 'Some ground damage possible in large quake',
      'High': 'Significant ground damage likely — check foundations',
      'Very High': 'Severe ground damage expected — engineering assessment recommended',
    };
    return { label: 'Liquefaction', sublabel: `${liq}${context[liq] ? ' — ' + context[liq] : ''}` };
  }
  if (layerId === 'layer-slope_failure_zones') {
    const sus = p.susceptibility as string;
    const context: Record<string, string> = {
      'Very Low': 'Negligible landslide risk',
      'Low': 'Minor risk — standard foundations sufficient',
      'Medium': 'Moderate risk — geotech report recommended',
      'High': 'Significant risk — geotech report essential',
      'Very High': 'Severe risk — specialist assessment required',
    };
    return { label: 'Slope failure', sublabel: `${sus}${context[sus] ? ' — ' + context[sus] : ''}` };
  }
  if (layerId === 'layer-wind_zones') {
    const names: Record<string, string> = { M: 'Moderate', H: 'High', VH: 'Very High', EH: 'Extreme', SED: 'Special Exposure' };
    const tips: Record<string, string> = { M: '', H: '', VH: 'Higher building standards apply', EH: 'Special design required', SED: 'Site-specific wind study needed' };
    const name = names[p.zone_name as string] ?? p.zone_name as string;
    const tip = tips[p.zone_name as string];
    return { label: 'Wind zone', sublabel: tip ? `${name} — ${tip}` : name };
  }
  if (layerId === 'layer-coastal_erosion') {
    const csi = p.csi_in as number | undefined;
    const level = csi == null ? '' : csi < 25 ? 'Low risk' : csi < 50 ? 'Moderate risk' : csi < 75 ? 'High risk' : 'Very high risk';
    return { label: 'Coastal erosion', sublabel: csi != null ? `CSI ${csi} — ${level}` : undefined };
  }
  if (layerId === 'layer-noise_contours') {
    const db = p.laeq24h as number | undefined;
    const level = db == null ? '' : db < 50 ? '(quiet)' : db < 55 ? '(moderate)' : db < 60 ? '(noticeable)' : db < 65 ? '(loud — may affect sleep)' : '(very loud — noise mitigation recommended)';
    return { label: `Noise: ${db ?? ''}dB ${level}`.trim() };
  }
  if (layerId === 'layer-conservation_land') return { label: p.name as string ?? 'Conservation land', sublabel: p.land_type as string };
  if (layerId === 'layer-school_zones') return { label: p.school_name as string ?? 'School zone' };
  if (layerId === 'layer-mv_nzdep_choropleth') {
    const d = p.nzdep as number;
    const context = d <= 2 ? 'Least deprived area' : d <= 4 ? 'Low deprivation' : d <= 6 ? 'Moderate deprivation' : d <= 8 ? 'Higher deprivation' : 'Most deprived area';
    return { label: `NZDep Decile ${d}`, sublabel: context };
  }
  if (layerId === 'layer-mv_crime_choropleth') {
    const v = p.victimisations as number;
    if (v === 0) return null;
    const levels = ['', 'Very low', 'Low', 'Moderate', 'High', 'Very high'];
    const level = levels[p.crime_level as number] ?? '';
    return { label: `${v} victimisations (3yr)`, sublabel: `${level} crime area` };
  }
  return null;
}

const LAYER_MINZOOM: Record<string, number> = {};
for (const l of TILE_LAYERS) {
  LAYER_MINZOOM[l.id] = l.minzoom;
}

const ADDRESSES_MINZOOM = 14;
const INTERACTIVE_LAYER_IDS = ['layer-addresses-click', 'layer-parcels', 'layer-building_outlines'];

// Pre-compute all possible query layer IDs (static)
const ALL_OVERLAY_LAYER_IDS = TILE_LAYERS.flatMap((l) => [
  `layer-${l.id}`,
  `layer-${l.id}-icon`,
  `layer-${l.id}-outline`,
]);
const ALL_QUERY_LAYER_IDS = [...INTERACTIVE_LAYER_IDS, ...ALL_OVERLAY_LAYER_IDS];

// Reusable empty GeoJSON to avoid creating new objects
const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Generate a GeoJSON circle (64-point polygon) for a distance ring */
function makeDistanceRing(lngCenter: number, latCenter: number, radiusMeters: number): GeoJSON.FeatureCollection {
  const points = 64;
  const coords: [number, number][] = [];
  const earthRadius = 6371000;
  const latRad = (latCenter * Math.PI) / 180;

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusMeters / earthRadius) * Math.cos(angle);
    const dLng = (radiusMeters / (earthRadius * Math.cos(latRad))) * Math.sin(angle);
    coords.push([
      lngCenter + (dLng * 180) / Math.PI,
      latCenter + (dLat * 180) / Math.PI,
    ]);
  }

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    }],
  };
}

export function MapContainer() {
  const mapRef = useRef<MapRef>(null);
  const viewport = useMapStore((s) => s.viewport);
  const setViewport = useMapStore((s) => s.setViewport);
  const activeLayers = useMapStore((s) => s.layers);
  const selectedAddress = useSearchStore((s) => s.selectedAddress);
  const selectedSuburb = useSearchStore((s) => s.selectedSuburb);
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const selectProperty = useMapStore((s) => s.selectProperty);
  const selectedPropertyId = useMapStore((s) => s.selectedPropertyId);
  const baseStyleId = useMapStore((s) => s.baseStyleId);
  const router = useRouter();
  const pathname = usePathname();
  const isOnPropertyPage = /^\/property\/\d+/.test(pathname);
  const currentPageAddressId = isOnPropertyPage
    ? parseInt(pathname.split('/')[2], 10) || null
    : null;
  const setShowUpgradeModal = useDownloadGateStore((s) => s.setShowUpgradeModal);
  const persona = usePersonaStore((s) => s.persona);
  const bp = useBreakpoint();

  const currentBasemap = getBasemapStyle(baseStyleId);

  // showPopup removed — no popup, just pin + address label
  const [pinVisible, setPinVisible] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [popupOverlayLines, setPopupOverlayLines] = useState<string[]>([]);
  const prevAddressRef = useRef<number | null>(null);
  // showPopupRef removed


  // Keyboard shortcut: L to open layer picker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'l' || e.key === 'L') {
        const trigger = document.querySelector<HTMLButtonElement>('[data-layer-picker-trigger]');
        trigger?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Stable hover GeoJSON data refs (avoid Source mount/unmount churn)
  const [hoverBuildingData, setHoverBuildingData] = useState<GeoJSON.Feature | null>(null);
  const [hoverAddressData, setHoverAddressData] = useState<GeoJSON.FeatureCollection>(EMPTY_GEOJSON);

  // Memoize active layer IDs + styles to avoid recalculating on every render
  const activeLayerEntries = useMemo(() => {
    return TILE_LAYERS
      .filter((l) => activeLayers[l.id])
      .map((l) => ({ id: l.id, styles: getLayerStyles(l.id) }))
      .filter((e) => e.styles.length > 0);
  }, [activeLayers]);

  const activeLayerIds = useMemo(() => activeLayerEntries.map((e) => e.id), [activeLayerEntries]);

  // flyTo when a new address is selected (from search bar)
  useEffect(() => {
    if (!selectedAddress || !mapRef.current) return;
    if (prevAddressRef.current === selectedAddress.addressId) return;
    prevAddressRef.current = selectedAddress.addressId;

    const map = mapRef.current.getMap();
    setPinVisible(false);

    const isMobile = window.innerWidth < 640;
    const padding = isMobile
      ? { top: 60, bottom: 240, left: 20, right: 20 }
      : { top: 80, bottom: 40, left: 20, right: 20 };

    if (prefersReducedMotion()) {
      map.jumpTo({
        center: [selectedAddress.lng, selectedAddress.lat],
        zoom: 17,
        padding,
      });
      setPinVisible(true);
    } else {
      map.flyTo({
        center: [selectedAddress.lng, selectedAddress.lat],
        zoom: 17,
        duration: TIMING.MAP_FLY_TO,
        essential: true,
        padding,
      });

      const pinTimer = setTimeout(() => setPinVisible(true), TIMING.POST_SELECT_PIN_DELAY);
      return () => clearTimeout(pinTimer);
    }
  }, [selectedAddress]);

  // flyTo when a suburb is selected (from search bar on mobile)
  useEffect(() => {
    if (!selectedSuburb || !mapRef.current) return;
    const map = mapRef.current.getMap();
    map.flyTo({
      center: [selectedSuburb.lng, selectedSuburb.lat],
      zoom: 14,
      duration: TIMING.MAP_FLY_TO,
      essential: true,
    });
  }, [selectedSuburb]);

  // Update Zustand only when interaction ends — keeps drag/zoom fully native speed
  const onMoveEnd = useCallback(
    (e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
      setViewport(e.viewState);
    },
    [setViewport],
  );

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    const map = mapRef.current?.getMap();
    if (map) {
      addRiskPatterns(map);
      addLayerIcons(map);
      map.on('style.load', () => {
        addRiskPatterns(map);
        addLayerIcons(map);
        // Enlarge street name labels on vector basemaps (Carto Positron, LINZ Topolite)
        try {
          for (const layer of map.getStyle()?.layers ?? []) {
            if (layer.type === 'symbol' && layer.layout?.['text-size'] != null) {
              const current = layer.layout['text-size'];
              if (typeof current === 'number' && current < 16) {
                map.setLayoutProperty(layer.id, 'text-size', Math.round(current * 1.3));
              }
            }
          }
        } catch { /* raster styles have no symbol layers */ }
      });
      // Rebuild hover layer cache after tiles arrive + move labels to top
      map.once('idle', () => {
        layerCacheDirtyRef.current = true;
        // Ensure our label layers render above everything (building outlines, hazard fills, etc)
        try {
          if (map.getLayer('layer-notable-places')) map.moveLayer('layer-notable-places');
          if (map.getLayer('layer-address-labels')) map.moveLayer('layer-address-labels');
        } catch { /* layers may not exist yet */ }
      });
    }
  }, []);

  const handleViewReport = useCallback(
    (addressId: number) => {
      // popup removed
      if (isOnPropertyPage) {
        // Different property on property page — navigate to it
        router.push(`/property/${addressId}`);
      } else if (window.innerWidth < 640) {
        // On mobile, report is already in the drawer — snap it to full
        window.dispatchEvent(new Event('drawer:snap-full'));
      } else {
        router.push(`/property/${addressId}`);
      }
    },
    [router, isOnPropertyPage, currentPageAddressId, setShowUpgradeModal, persona],
  );



  // Cache which layer IDs exist on the map
  const validLayerIdsRef = useRef<string[]>([]);
  const layerCacheDirtyRef = useRef(true);
  useEffect(() => {
    layerCacheDirtyRef.current = true;
    // Re-raise label layers above any newly added tile layers
    const map = mapRef.current?.getMap();
    if (map) {
      try {
        if (map.getLayer('layer-notable-places')) map.moveLayer('layer-notable-places');
        if (map.getLayer('layer-address-labels')) map.moveLayer('layer-address-labels');
      } catch { /* ignore */ }
    }
  }, [activeLayers, baseStyleId, mapLoaded]);

  /** Collect overlay labels at a point using cached layer list */
  const getOverlayLinesAtPoint = useCallback((map: maplibregl.Map, point: maplibregl.PointLike): string[] => {
    // Use the same cached layer list as handleMouseMove
    if (layerCacheDirtyRef.current) {
      validLayerIdsRef.current = ALL_QUERY_LAYER_IDS.filter((id) => map.getLayer(id));
      layerCacheDirtyRef.current = false;
    }
    const overlayIds = validLayerIdsRef.current.filter(id => !INTERACTIVE_LAYER_IDS.includes(id));
    if (overlayIds.length === 0) return [];
    const features = map.queryRenderedFeatures(point, { layers: overlayIds });
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const f of features) {
      const info = getFeatureLabel(f);
      if (!info) continue;
      const key = info.label + (info.sublabel ?? '');
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(info.sublabel ? `${info.label}: ${info.sublabel}` : info.label);
    }
    return lines;
  }, []);

  // Handle map click — uses ref for showPopup to avoid recreating on every popup toggle
  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const features = map.queryRenderedFeatures(e.point, {
        layers: INTERACTIVE_LAYER_IDS.filter((id) => map.getLayer(id)),
      });

      if (features && features.length > 0) {
        const addressFeature = features.find(
          (f) => f.layer.id === 'layer-addresses-click' && f.properties?.address_id
        );

        if (addressFeature && addressFeature.properties) {
          const props = addressFeature.properties;
          const geom = addressFeature.geometry;
          let lng = e.lngLat.lng;
          let lat = e.lngLat.lat;
          if (geom.type === 'Point') {
            lng = geom.coordinates[0];
            lat = geom.coordinates[1];
          }

          const addressId = Number(props.address_id);
          const fullAddress = String(props.full_address || `Address #${addressId}`);

          selectAddress({ addressId, fullAddress, lng, lat });
          selectProperty(addressId, lng, lat);
          prevAddressRef.current = addressId;
          setPinVisible(true);
          // Pan to center the popup in the visible area
          const isMobile = window.innerWidth < 640;
          map.easeTo({
            center: [lng, lat],
            padding: isMobile
              ? { top: 60, bottom: 240, left: 20, right: 20 }
              : { top: 80, bottom: 40, left: 20, right: 20 },
            duration: 400,
          });
          return;
        }

        const buildingHit = features.find(f => f.layer.id === 'layer-building_outlines');
        if (buildingHit && map.getLayer('layer-addresses-click')) {
          const R = 30;
          const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
            [e.point.x - R, e.point.y - R],
            [e.point.x + R, e.point.y + R],
          ];
          const candidates = map
            .queryRenderedFeatures(bbox, { layers: ['layer-addresses-click'] })
            .filter(f => f.properties?.address_id);

          if (candidates.length > 0) {
            const closest = candidates.reduce((best, f) => {
              if (f.geometry.type !== 'Point') return best;
              const px = map.project(f.geometry.coordinates as [number, number]);
              const dx = px.x - e.point.x, dy = px.y - e.point.y;
              const dist = dx * dx + dy * dy;
              return dist < best.dist ? { f, dist } : best;
            }, { f: candidates[0], dist: Infinity }).f;

            const props = closest.properties!;
            const geom = closest.geometry;
            let lng = e.lngLat.lng, lat = e.lngLat.lat;
            if (geom.type === 'Point') {
              lng = geom.coordinates[0];
              lat = geom.coordinates[1];
            }
            const addressId = Number(props.address_id);
            const fullAddress = String(props.full_address || `Address #${addressId}`);
            selectAddress({ addressId, fullAddress, lng, lat });
            selectProperty(addressId, lng, lat);
            prevAddressRef.current = addressId;
            setPinVisible(true);
            // Pan to center the popup in the visible area
            const isMobileB = window.innerWidth < 640;
            map.easeTo({
              center: [lng, lat],
              padding: isMobileB
                ? { top: 60, bottom: 240, left: 20, right: 20 }
                : { top: 80, bottom: 40, left: 20, right: 20 },
              duration: 400,
            });
            return;
          }
        }

        // Tap fell on a non-address feature (POI, transit stop, hazard zone,
        // etc.). Before the fix these clicks were silently dropped. Now we
        // surface the feature's own label in a toast so users can at least
        // see what they tapped on — particularly important on mobile where
        // hover tooltips don't exist.
        for (const f of features) {
          const info = getFeatureLabel(f);
          if (info) {
            toast(info.label, {
              description: info.sublabel,
              duration: 3500,
            });
            return;
          }
        }
      }

    },
    [selectAddress, selectProperty],
  );

  // Hover tooltip — throttled to avoid excessive state updates
  const lastHoverRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });

  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      // Skip on touch devices — no hover concept
      if ('ontouchstart' in window) return;
      const map = mapRef.current?.getMap();
      if (!map) return;

      // Throttle: skip if mouse hasn't moved enough (< 3px) and < 32ms elapsed
      const now = Date.now();
      const dx = e.point.x - lastHoverRef.current.x;
      const dy = e.point.y - lastHoverRef.current.y;
      if (dx * dx + dy * dy < 9 && now - lastHoverRef.current.time < 32) return;
      lastHoverRef.current = { x: e.point.x, y: e.point.y, time: now };

      // Rebuild cached layer list only when layers change
      if (layerCacheDirtyRef.current) {
        validLayerIdsRef.current = ALL_QUERY_LAYER_IDS.filter((id) => map.getLayer(id));
        layerCacheDirtyRef.current = false;
      }

      const features = map.queryRenderedFeatures(e.point, { layers: validLayerIdsRef.current });

      if (!features || features.length === 0) {
        map.getCanvas().style.cursor = '';
        setHoverInfo(null);
        setHoverBuildingData(null);
        setHoverAddressData(EMPTY_GEOJSON);
        return;
      }

      map.getCanvas().style.cursor = 'pointer';

      // Single pass: classify features
      let addressFeature: maplibregl.MapGeoJSONFeature | undefined;
      let building: maplibregl.MapGeoJSONFeature | null = null;
      const seen = new Set<string>();
      const overlayLines: string[] = [];

      for (const f of features) {
        const lid = f.layer.id;
        if (lid === 'layer-addresses-click') {
          if (!addressFeature && f.properties?.address_id) addressFeature = f;
          continue;
        }
        if (lid === 'layer-building_outlines' || lid === 'layer-building_outlines-outline') {
          if (!building) building = f;
        }
        const info = getFeatureLabel(f);
        if (!info) continue;
        const key = info.label + (info.sublabel ?? '');
        if (seen.has(key)) continue;
        seen.add(key);
        overlayLines.push(info.sublabel ? `${info.label}: ${info.sublabel}` : info.label);
      }

      // Update hover highlight data (stable Source, just update data)
      // Strip to plain GeoJSON — MapGeoJSONFeature has internal classes that
      // can't be serialized by maplibre's web worker.
      setHoverBuildingData(
        building
          ? { type: 'Feature' as const, geometry: building.geometry, properties: {} }
          : null
      );

      if (addressFeature && addressFeature.geometry.type === 'Point') {
        const props = addressFeature.properties!;
        const coords = addressFeature.geometry.coordinates as [number, number];
        const addressId = Number(props.address_id);
        const fullAddress = String(props.full_address || `Address #${addressId}`);

        setHoverAddressData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coords },
            properties: {},
          }],
        });

        setHoverInfo({
          x: e.point.x, y: e.point.y,
          label: fullAddress,
          lines: overlayLines.length > 0 ? overlayLines : undefined,
          sublabel: overlayLines.length === 0
            ? (building?.properties?.name || (building?.properties?.use as string) || undefined)
            : undefined,
        });
        return;
      }

      setHoverAddressData(EMPTY_GEOJSON);

      if (overlayLines.length > 0) {
        setHoverInfo({
          x: e.point.x, y: e.point.y,
          label: overlayLines[0],
          lines: overlayLines.length > 1 ? overlayLines.slice(1) : undefined,
        });
        return;
      }

      setHoverInfo(null);
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
    setHoverBuildingData(null);
    setHoverAddressData(EMPTY_GEOJSON);
  }, []);

  return (
    <div
      data-tour="map"
      className="relative w-full h-full"
      role="application"
      aria-label="Interactive property map of New Zealand"
      // Belt-and-braces: react-map-gl's onMouseLeave only fires when the
      // mouse exits the canvas. Leaving onto a sibling overlay (legend,
      // style picker) or the report pane next to the map could leave
      // hoverInfo stuck visible. Catching pointer-leave on the outer
      // wrapper covers that case.
      onMouseLeave={handleMouseLeave}
      onPointerLeave={handleMouseLeave}
    >
      <Map
        ref={mapRef}
        initialViewState={viewport}
        onMoveEnd={onMoveEnd}
        onDragStart={() => window.dispatchEvent(new Event('drawer:collapse'))}
        onLoad={handleMapLoad}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        mapStyle={currentBasemap.style}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        maxZoom={18}
        minZoom={5}
        maxBounds={[
          [165, -48],
          [180, -34],
        ]}
      >
        <AttributionControl compact position="bottom-right" />
        <ScaleControl position="bottom-left" maxWidth={120} unit="metric" />

        {/* Distance ring around selected property — 500m dashed circle */}
        {selectedAddress && pinVisible && (
          <Source
            id="source-distance-ring"
            type="geojson"
            data={makeDistanceRing(selectedAddress.lng, selectedAddress.lat, 500)}
          >
            <Layer
              id="layer-distance-ring"
              type="line"
              paint={{
                'line-color': '#0D7377',
                'line-width': 2.5,
                'line-dasharray': [4, 2],
                'line-opacity': 0.75,
              }}
            />
            <Layer
              id="layer-distance-ring-label"
              type="symbol"
              layout={{
                'symbol-placement': 'line',
                'text-field': '500m',
                'text-size': 11,
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                'text-offset': [0, -0.7],
                'text-allow-overlap': false,
              }}
              paint={{
                'text-color': '#0D7377',
                'text-halo-color': 'rgba(255,255,255,0.85)',
                'text-halo-width': 1.5,
                'text-opacity': 0.8,
              }}
            />
          </Source>
        )}

        {/* Addresses layer — invisible hit target + visible dots at high zoom */}
        {mapLoaded && (
          <Source
            id="source-addresses-click"
            type="vector"
            tiles={[getTileUrl('addresses')]}
            minzoom={ADDRESSES_MINZOOM}
            maxzoom={14}
          >
            <Layer
              id="layer-addresses-click"
              source="source-addresses-click"
              source-layer="addresses"
              type="circle"
              minzoom={ADDRESSES_MINZOOM}
              paint={{
                'circle-radius': 24,
                'circle-color': 'transparent',
                'circle-opacity': 0,
              }}
            />
            <Layer
              id="layer-addresses-dots"
              source="source-addresses-click"
              source-layer="addresses"
              type="circle"
              minzoom={ADDRESSES_MINZOOM}
              paint={{
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  14, 1.5,
                  15, 2.5,
                  16, 4,
                  17, 5.5,
                  18, 7,
                ],
                'circle-color': '#14B8A6',
                'circle-opacity': [
                  'interpolate', ['linear'], ['zoom'],
                  14, 0.2,
                  15, 0.35,
                  16, 0.5,
                  18, 0.7,
                ],
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': [
                  'interpolate', ['linear'], ['zoom'],
                  14, 0.15,
                  15, 0.3,
                  16, 0.6,
                  18, 0.8,
                ],
              }}
            />
          </Source>
        )}

        {/* Notable places — supermarkets, schools, parks etc */}
        {mapLoaded && (
          <Source
            id="source-notable-places"
            type="vector"
            tiles={[getTileUrl('notable_places')]}
            minzoom={15}
            maxzoom={18}
          >
            {/* Google Maps-style POI icons — white symbol on colored circle */}
            <Layer
              id="layer-notable-places"
              source="source-notable-places"
              source-layer="notable_places"
              type="symbol"
              minzoom={15}
              layout={{
                'icon-image': ['match', ['get', 'kind'],
                  'hospital',           'poi-hospital',
                  'doctors',            'poi-doctors',
                  'pharmacy',           'poi-pharmacy',
                  'park',               'poi-park',
                  'playground',         'poi-playground',
                  'zoo',                'poi-park',
                  'school',             'poi-school',
                  'university',         'poi-university',
                  'supermarket',        'poi-supermarket',
                  'library',            'poi-library',
                  'cafe',               'poi-cafe',
                  'restaurant',         'poi-restaurant',
                  'museum',             'poi-museum',
                  'gallery',            'poi-museum',
                  'cinema',             'poi-museum',
                  'theatre',            'poi-museum',
                  'sports_centre',      'poi-sports',
                  'swimming_pool',      'poi-sports',
                  'fitness_centre',     'poi-sports',
                  'community_centre',   'poi-default',
                  'charging_station',   'poi-charging',
                  'fuel',               'poi-default',
                  'bank',               'poi-default',
                  'poi-default',
                ],
                'icon-size': [
                  'interpolate', ['linear'], ['zoom'],
                  15, 0.7,
                  16, 0.85,
                  17, 1,
                ],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'symbol-sort-key': ['get', 'priority'],
              }}
            />
            {/* Name label below the icon circle — colored for medical/nature, white otherwise */}
            <Layer
              id="layer-notable-places-label"
              source="source-notable-places"
              source-layer="notable_places"
              type="symbol"
              minzoom={16}
              layout={{
                'text-field': ['get', 'label'],
                'text-size': [
                  'interpolate', ['linear'], ['zoom'],
                  16, 11,
                  17, 12,
                  18, 13,
                ],
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                'text-anchor': 'top',
                'text-offset': [0, 1.8],
                'text-max-width': 8,
                'text-allow-overlap': false,
                'text-optional': true,
                'text-padding': 4,
                'symbol-sort-key': ['get', 'priority'],
              }}
              paint={{
                'text-color': [
                  'match', ['get', 'kind'],
                  'hospital', '#EF4444',
                  'doctors', '#EF4444',
                  'pharmacy', '#EF4444',
                  'park', '#4ADE80',
                  'playground', '#4ADE80',
                  'zoo', '#4ADE80',
                  '#FFFFFF',
                ],
                'text-halo-color': 'rgba(0,0,0,0.7)',
                'text-halo-width': 1.5,
              }}
            />
          </Source>
        )}

        {/* Address number labels — centred on building outlines via Martin function */}
        {mapLoaded && (
          <Source
            id="source-address-labels"
            type="vector"
            tiles={[getTileUrl('address_labels')]}
            minzoom={17}
            maxzoom={18}
          >
            <Layer
              id="layer-address-labels"
              source="source-address-labels"
              source-layer="address_labels"
              type="symbol"
              minzoom={17}
              layout={{
                'text-field': ['get', 'address_number'],
                'text-size': [
                  'interpolate', ['linear'], ['zoom'],
                  17, 10,
                  18, 12,
                  19, 14,
                ],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-anchor': 'center',
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-optional': true,
                'text-padding': 3,
              }}
              paint={{
                'text-color': '#334155',
                'text-halo-color': 'rgba(255,255,255,0.9)',
                'text-halo-width': 2,
                'text-halo-blur': 0.5,
                'text-opacity': [
                  'interpolate', ['linear'], ['zoom'],
                  17, 0.7,
                  18, 0.95,
                ],
              }}
            />
          </Source>
        )}

        {/* Hover feedback — stable Sources that update data instead of mount/unmount */}
        {mapLoaded && (
          <Source
            id="source-hover-building"
            type="geojson"
            data={hoverBuildingData ?? EMPTY_GEOJSON}
          >
            <Layer
              id="layer-hover-building-fill"
              type="fill"
              paint={{
                'fill-color': '#0D7377',
                'fill-opacity': 0.15,
              }}
            />
            <Layer
              id="layer-hover-building-stroke"
              type="line"
              paint={{
                'line-color': '#0D7377',
                'line-width': 2,
                'line-opacity': 0.4,
              }}
            />
          </Source>
        )}

        {mapLoaded && (
          <Source
            id="source-hover-address-ring"
            type="geojson"
            data={hoverAddressData}
          >
            <Layer
              id="layer-hover-address-ring"
              type="circle"
              paint={{
                'circle-radius': 28,
                'circle-color': '#0D7377',
                'circle-opacity': 0,
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#0D7377',
                'circle-stroke-opacity': 0.6,
              }}
            />
          </Source>
        )}

        {/* User-toggled vector tile layers from Martin */}
        {mapLoaded &&
          activeLayerEntries.map(({ id: layerId, styles }) => (
            <Source
              key={layerId}
              id={`source-${layerId}`}
              type="vector"
              tiles={[getTileUrl(layerId)]}
              minzoom={LAYER_MINZOOM[layerId] ?? 8}
              maxzoom={14}
            >
              {styles.map((style) => (
                <Layer key={style.id} {...style} />
              ))}
            </Source>
          ))}

        {/* SA2 area labels — NZ statistical areas, visible below suburb zoom where OFM labels take over */}
        {mapLoaded && (
          <Source
            id="source-sa2-labels"
            type="vector"
            tiles={[getTileUrl('sa2_boundaries')]}
            minzoom={8}
            maxzoom={14}
          >
            <Layer
              id="layer-sa2-labels"
              source="source-sa2-labels"
              source-layer="sa2_boundaries"
              type="symbol"
              minzoom={8}
              maxzoom={12}
              layout={{
                'text-field': ['coalesce', ['get', 'name'], ''],
                'text-size': [
                  'interpolate', ['linear'], ['zoom'],
                  8, 10,
                  11, 13,
                ],
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                'text-anchor': 'center',
                'text-max-width': 10,
                'symbol-placement': 'point',
                'text-allow-overlap': false,
              }}
              paint={{
                'text-color': '#FFFFFF',
                'text-halo-color': 'rgba(0, 0, 0, 0.65)',
                'text-halo-width': 1.5,
                'text-opacity': [
                  'interpolate', ['linear'], ['zoom'],
                  8, 0.6,
                  10, 0.85,
                  12, 0,
                ],
              }}
            />
          </Source>
        )}

        {/* Vector labels on satellite/dark basemaps — Google-style white text with dark outlines */}
        {mapLoaded && (SATELLITE_STYLE_IDS.has(baseStyleId) || baseStyleId === 'dark') && (
          <Source
            id={LABEL_SOURCE_ID}
            type="vector"
            tiles={[LABEL_TILE_URL]}
            maxzoom={14}
          >
            {LABEL_LAYERS_LIGHT.map((layer) => (
              <Layer key={layer.id} {...layer} />
            ))}
          </Source>
        )}

        {/* Compass rose on distance ring — north indicator */}
        {selectedAddress && pinVisible && (() => {
          const earthR = 6371000;
          const latRad = (selectedAddress.lat * Math.PI) / 180;
          const dLat = (500 / earthR) * (180 / Math.PI);
          return (
            <Marker
              longitude={selectedAddress.lng}
              latitude={selectedAddress.lat + dLat}
              anchor="center"
            >
              <div className="flex flex-col items-center animate-fade-in" style={{ opacity: 0.7 }}>
                <span className="text-xs font-bold text-piq-primary drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">N</span>
                <svg width="8" height="6" viewBox="0 0 8 6" className="text-piq-primary -mt-0.5">
                  <polygon points="4,0 0,6 8,6" fill="currentColor" />
                </svg>
              </div>
            </Marker>
          );
        })()}

        {/* Selected property pin + address label */}
        {selectedAddress && pinVisible && (
          <>
            <Marker
              longitude={selectedAddress.lng}
              latitude={selectedAddress.lat}
              anchor="bottom"
            >
              <div className="relative animate-bounce-in">
                <div className="absolute -inset-3 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-piq-primary/30 animate-pulse-ring" />
                </div>
                <MapPin
                  className="h-8 w-8 text-piq-primary drop-shadow-lg"
                  fill="currentColor"
                  strokeWidth={1.5}
                />
              </div>
            </Marker>
            {/* Address label next to pin */}
            <Marker
              longitude={selectedAddress.lng}
              latitude={selectedAddress.lat}
              anchor="left"
              offset={[16, -16]}
            >
              <div className="bg-background/95 backdrop-blur border border-border rounded-md px-2 py-1 shadow-sm pointer-events-none">
                <p className="text-xs font-medium text-foreground whitespace-nowrap max-w-[220px] truncate">
                  {selectedAddress.fullAddress.split(',')[0]}
                </p>
              </div>
            </Marker>
          </>
        )}
      </Map>

      {/* Layer chip bar */}
      <div className="absolute top-2 left-2 right-14 lg:right-16 z-10">
        <MapLayerChipBar />
      </div>

      {/* Map controls — right side */}
      <MapControls mapRef={mapRef} />

      {/* Map style picker — bottom left */}
      <MapStylePicker />

      {/* Legend */}
      <MapLegend />

      {/* Hover tooltip — desktop only (no hover on touch devices) */}
      {hoverInfo && bp !== 'mobile' && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs rounded-lg bg-background/95 backdrop-blur border border-border shadow-md px-3 py-2 text-sm"
          style={{ left: hoverInfo.x + 12, top: hoverInfo.y - 12, transform: 'translateY(-100%)' }}
        >
          <p className="font-medium leading-snug">{hoverInfo.label}</p>
          {hoverInfo.lines?.length ? (
            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {hoverInfo.lines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          ) : hoverInfo.sublabel ? (
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{hoverInfo.sublabel}</p>
          ) : null}
        </div>
      )}

      {/* Zoom hint — contextual based on zoom level. Positioned 16 px
          above the mobile drawer's peek height (220 px sheet + handle
          padding = ~240 px) so it can't overlap the drag handle; on
          desktop it sits above the attribution bar. */}
      {(viewport.zoom <= 15 && !selectedAddress) && (
        <div className="absolute bottom-[252px] sm:bottom-12 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur border border-border shadow-sm text-xs text-muted-foreground animate-slide-up-fade pointer-events-none">
          {viewport.zoom < 8
            ? 'Zoom in or search for an address to get started'
            : viewport.zoom < 11
              ? 'Zoom in closer to see properties'
              : 'Tap a building or search for an address'
          }
        </div>
      )}
    </div>
  );
}
