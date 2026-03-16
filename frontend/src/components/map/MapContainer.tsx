'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Source,
  Layer,
  Marker,
  Popup,
  AttributionControl,
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
import { TIMING } from '@/lib/animations';
import { MapLayerChipBar } from './MapLayerChipBar';
import { MapLegend } from './MapLegend';
import { MapStylePicker } from './MapStylePicker';
import { MapPopup } from './MapPopup';
import { MapControls } from './MapControls';
import { MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  // Normalize sub-layer IDs (e.g. layer-transit_stops-icon → layer-transit_stops)
  const rawId = feature.layer.id;
  const layerId = rawId.replace(/-icon$/, '').replace(/-outline$/, '');

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
  // Active overlay layers
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
    return { label: 'Crash site', sublabel: p.severity as string };
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
  if (layerId === 'layer-flood_zones') return { label: 'Flood zone', sublabel: p.title as string || p.label as string };
  if (layerId === 'layer-tsunami_zones') {
    const zc = p.zone_class as number | undefined;
    const zone = zc ? `Zone ${zc}` : undefined;
    const evac = p.evac_zone as string | undefined;
    return { label: 'Tsunami zone', sublabel: [zone, evac].filter(Boolean).join(' · ') || undefined };
  }
  if (layerId === 'layer-liquefaction_zones') return { label: 'Liquefaction', sublabel: p.liquefaction as string };
  if (layerId === 'layer-slope_failure_zones') return { label: 'Slope failure', sublabel: p.susceptibility as string };
  if (layerId === 'layer-wind_zones') {
    const names: Record<string, string> = { M: 'Moderate', H: 'High', VH: 'Very High', EH: 'Extreme', SED: 'Special Exposure' };
    return { label: 'Wind zone', sublabel: names[p.zone_name as string] ?? p.zone_name as string };
  }
  if (layerId === 'layer-coastal_erosion') {
    const csi = p.csi_in as number | undefined;
    return { label: 'Coastal erosion', sublabel: csi != null ? `CSI ${csi}` : undefined };
  }
  if (layerId === 'layer-noise_contours') return { label: `Noise: ${p.laeq24h ?? ''}dB` };
  if (layerId === 'layer-conservation_land') return { label: p.name as string ?? 'Conservation land', sublabel: p.land_type as string };
  if (layerId === 'layer-school_zones') return { label: p.school_name as string ?? 'School zone' };
  return null;
}

const LAYER_MINZOOM: Record<string, number> = {};
for (const l of TILE_LAYERS) {
  LAYER_MINZOOM[l.id] = l.minzoom;
}

// The addresses layer is always loaded (invisible) so we can click on features
const ADDRESSES_MINZOOM = 14;
// IDs for the clickable layers we listen to
const INTERACTIVE_LAYER_IDS = ['layer-addresses-click', 'layer-parcels', 'layer-building_outlines'];

// Pre-compute all possible query layer IDs (static — avoids flatMap on every mouse move)
const ALL_OVERLAY_LAYER_IDS = TILE_LAYERS.flatMap((l) => [
  `layer-${l.id}`,
  `layer-${l.id}-icon`,
  `layer-${l.id}-outline`,
]);
const ALL_QUERY_LAYER_IDS = [...INTERACTIVE_LAYER_IDS, ...ALL_OVERLAY_LAYER_IDS];

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function MapContainer() {
  const mapRef = useRef<MapRef>(null);
  const viewport = useMapStore((s) => s.viewport);
  const setViewport = useMapStore((s) => s.setViewport);
  const activeLayers = useMapStore((s) => s.layers);
  const selectedAddress = useSearchStore((s) => s.selectedAddress);
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const selectProperty = useMapStore((s) => s.selectProperty);
  const selectedPropertyId = useMapStore((s) => s.selectedPropertyId);
  const baseStyleId = useMapStore((s) => s.baseStyleId);
  const router = useRouter();

  const currentBasemap = getBasemapStyle(baseStyleId);

  const [showPopup, setShowPopup] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [hoveredAddress, setHoveredAddress] = useState<{ id: number; label: string; lng: number; lat: number } | null>(null);
  const [hoveredBuilding, setHoveredBuilding] = useState<maplibregl.GeoJSONFeature | null>(null);
  const [popupOverlayLines, setPopupOverlayLines] = useState<string[]>([]);
  const prevAddressRef = useRef<number | null>(null);

  // flyTo when a new address is selected
  useEffect(() => {
    if (!selectedAddress || !mapRef.current) return;
    if (prevAddressRef.current === selectedAddress.addressId) return;
    prevAddressRef.current = selectedAddress.addressId;

    const map = mapRef.current.getMap();
    setPinVisible(false);
    setShowPopup(false);

    if (prefersReducedMotion()) {
      map.jumpTo({
        center: [selectedAddress.lng, selectedAddress.lat],
        zoom: 17,
      });
      setPinVisible(true);
      setShowPopup(true);
    } else {
      map.flyTo({
        center: [selectedAddress.lng, selectedAddress.lat],
        zoom: 17,
        duration: TIMING.MAP_FLY_TO,
        essential: true,
      });

      const pinTimer = setTimeout(() => setPinVisible(true), TIMING.POST_SELECT_PIN_DELAY);
      const popupTimer = setTimeout(() => setShowPopup(true), TIMING.POST_SELECT_SHEET_DELAY);

      return () => {
        clearTimeout(pinTimer);
        clearTimeout(popupTimer);
      };
    }
  }, [selectedAddress]);

  const onMove = useCallback(
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
      // Re-add images whenever the basemap style is swapped
      map.on('style.load', () => {
        addRiskPatterns(map);
        addLayerIcons(map);
      });
    }
  }, []);

  const handleViewReport = useCallback(
    (addressId: number) => {
      router.push(`/property/${addressId}`);
    },
    [router],
  );

  const handlePopupClose = useCallback(() => {
    setShowPopup(false);
  }, []);

  /** Collect overlay layer labels at a screen point (for popup context on tap/click). */
  const getOverlayLinesAtPoint = useCallback((map: maplibregl.Map, point: maplibregl.PointLike): string[] => {
    const overlayLayers = ALL_OVERLAY_LAYER_IDS.filter((id) => map.getLayer(id));
    if (overlayLayers.length === 0) return [];
    const features = map.queryRenderedFeatures(point, { layers: overlayLayers });
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

  // Handle map click — select a property from the addresses tile layer
  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      // Query for address features near the click point
      const features = map.queryRenderedFeatures(e.point, {
        layers: INTERACTIVE_LAYER_IDS.filter((id) => map.getLayer(id)),
      });

      if (features && features.length > 0) {
        // Prefer address features (they have address_id)
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
          setPopupOverlayLines(getOverlayLinesAtPoint(map, e.point));
          setPinVisible(true);
          setShowPopup(true);
          return;
        }

        // No address at exact point — did we hit a building?
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
            setPopupOverlayLines(getOverlayLinesAtPoint(map, e.point));
            setPinVisible(true);
            setShowPopup(true);
            return;
          }
        }
      }

      // If user clicked on nothing while popup is showing, close it
      if (showPopup) {
        setShowPopup(false);
      }
    },
    [selectAddress, selectProperty, showPopup, getOverlayLinesAtPoint],
  );

  // Cache which layer IDs actually exist on the map to avoid per-move getLayer() calls
  const validLayerIdsRef = useRef<string[]>([]);
  const layerCacheDirtyRef = useRef(true);

  // Invalidate cache when active layers or map style changes
  useEffect(() => { layerCacheDirtyRef.current = true; }, [activeLayers, baseStyleId]);

  // Cursor + hover tooltip
  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      // Rebuild cached layer list only when layers change (not on every move)
      if (layerCacheDirtyRef.current) {
        validLayerIdsRef.current = ALL_QUERY_LAYER_IDS.filter((id) => map.getLayer(id));
        layerCacheDirtyRef.current = false;
      }

      // Single queryRenderedFeatures call — extracts address, building, and overlay info
      const features = map.queryRenderedFeatures(e.point, { layers: validLayerIdsRef.current });

      if (!features || features.length === 0) {
        map.getCanvas().style.cursor = '';
        setHoverInfo(null);
        setHoveredAddress(null);
        setHoveredBuilding(null);
        return;
      }

      map.getCanvas().style.cursor = 'pointer';

      // Single pass: classify features from the one query
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
          // Still get its label for overlay lines below
        }
        const info = getFeatureLabel(f);
        if (!info) continue;
        const key = info.label + (info.sublabel ?? '');
        if (seen.has(key)) continue;
        seen.add(key);
        overlayLines.push(info.sublabel ? `${info.label}: ${info.sublabel}` : info.label);
      }

      // Address present: show as main label with overlay lines stacked
      if (addressFeature && addressFeature.geometry.type === 'Point') {
        const props = addressFeature.properties!;
        const coords = addressFeature.geometry.coordinates as [number, number];
        const addressId = Number(props.address_id);
        const fullAddress = String(props.full_address || `Address #${addressId}`);

        setHoveredAddress({ id: addressId, label: fullAddress, lng: coords[0], lat: coords[1] });
        setHoveredBuilding(building);

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

      // No address — show overlay features
      setHoveredAddress(null);
      setHoveredBuilding(null);

      if (overlayLines.length > 0) {
        setHoverInfo({
          x: e.point.x, y: e.point.y,
          label: overlayLines[0],
          lines: overlayLines.length > 1 ? overlayLines.slice(1) : undefined,
        });
        return;
      }

      // Fallback — nothing useful
      setHoverInfo(null);
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
    setHoveredAddress(null);
    setHoveredBuilding(null);
  }, []);

  const activeLayerIds = TILE_LAYERS.filter((l) => activeLayers[l.id]).map((l) => l.id);

  return (
    <div
      className="relative w-full h-full"
      role="application"
      aria-label="Interactive property map of New Zealand"
    >
      <Map
        ref={mapRef}
        longitude={viewport.longitude}
        latitude={viewport.latitude}
        zoom={viewport.zoom}
        onMove={onMove}
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

        {/* Addresses layer — invisible hit target + visible dots at high zoom */}
        {mapLoaded && (
          <Source
            id="source-addresses-click"
            type="vector"
            tiles={[getTileUrl('addresses')]}
            minzoom={ADDRESSES_MINZOOM}
            maxzoom={14}
          >
            {/* Invisible hit target — large radius for easy tap/click */}
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
            {/* Visible dots — subtle hints that show "tap here" at close zoom */}
            <Layer
              id="layer-addresses-dots"
              source="source-addresses-click"
              source-layer="addresses"
              type="circle"
              minzoom={15}
              paint={{
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  15, 1.5,
                  16, 2.5,
                  17, 3.5,
                  18, 4.5,
                ],
                'circle-color': '#14B8A6',
                'circle-opacity': [
                  'interpolate', ['linear'], ['zoom'],
                  15, 0.25,
                  16, 0.4,
                  18, 0.65,
                ],
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': [
                  'interpolate', ['linear'], ['zoom'],
                  15, 0.2,
                  16, 0.5,
                  18, 0.75,
                ],
              }}
            />
          </Source>
        )}

        {/* Hover feedback: building highlight + address ring */}
        {mapLoaded && hoveredBuilding && (
          <Source
            id="source-hover-building"
            type="geojson"
            data={hoveredBuilding as any}
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

        {/* Hover address ring */}
        {mapLoaded && hoveredAddress && (
          <Source
            id="source-hover-address-ring"
            type="geojson"
            data={{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [hoveredAddress.lng, hoveredAddress.lat],
              },
              properties: {},
            }}
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
          activeLayerIds.map((layerId) => {
            const layerStyles = getLayerStyles(layerId);
            if (!layerStyles.length) return null;

            return (
              <Source
                key={layerId}
                id={`source-${layerId}`}
                type="vector"
                tiles={[getTileUrl(layerId)]}
                minzoom={LAYER_MINZOOM[layerId] ?? 8}
                maxzoom={14}
              >
                {layerStyles.map((style) => (
                  <Layer key={style.id} {...style} />
                ))}
              </Source>
            );
          })}

        {/* Always-visible suburb/locality labels — rendered on top of all layers */}
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
              maxzoom={15}
              layout={{
                'text-field': ['coalesce', ['get', 'name'], ''],
                'text-size': [
                  'interpolate', ['linear'], ['zoom'],
                  8, 10,
                  12, 13,
                  15, 12,
                ],
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                'text-anchor': 'center',
                'text-max-width': 10,
                'symbol-placement': 'point',
                'text-allow-overlap': false,
              }}
              paint={{
                'text-color': '#FFFFFF',
                'text-halo-color': 'rgba(0, 0, 0, 0.6)',
                'text-halo-width': 1.5,
                'text-opacity': [
                  'interpolate', ['linear'], ['zoom'],
                  8, 0.6,
                  12, 0.9,
                  15, 0,
                ],
              }}
            />
          </Source>
        )}

        {/* Street/place labels on satellite basemaps — CARTO dark labels overlay */}
        {mapLoaded && SATELLITE_STYLE_IDS.has(baseStyleId) && (
          <Source
            id="source-carto-labels"
            type="raster"
            tiles={[
              'https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
            ]}
            tileSize={256}
            maxzoom={18}
          >
            <Layer id="layer-carto-labels" type="raster" />
          </Source>
        )}

        {/* Selected property marker */}
        {selectedAddress && pinVisible && (
          <Marker
            longitude={selectedAddress.lng}
            latitude={selectedAddress.lat}
            anchor="bottom"
            onClick={() => {
              if (!selectedAddress) return;
              selectProperty(selectedAddress.addressId, selectedAddress.lng, selectedAddress.lat);
              setShowPopup(true);
            }}
          >
            <div className="relative">
              <div className="absolute -inset-3 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-piq-primary/30 animate-pulse-ring" />
              </div>
              <div className="animate-bounce-in">
                <MapPin
                  className="h-9 w-9 text-piq-primary drop-shadow-lg"
                  fill="currentColor"
                  strokeWidth={1.5}
                />
              </div>
            </div>
          </Marker>
        )}

        {/* Property popup */}
        {showPopup && selectedAddress && (
          <Popup
            longitude={selectedAddress.lng}
            latitude={selectedAddress.lat}
            anchor="bottom"
            offset={[0, 20] as [number, number]}
            closeOnClick={true}
            onClose={handlePopupClose}
          >
            <div className="animate-slide-up-fade">
              <MapPopup
                addressId={selectedAddress.addressId}
                onViewReport={handleViewReport}
                onClose={handlePopupClose}
                overlayLines={popupOverlayLines}
              />
            </div>
          </Popup>
        )}
      </Map>

      {/* Layer chip bar — sits at the top of the map, below the header */}
      <div className="absolute top-2 left-2 right-14 lg:right-16 z-10">
        <MapLayerChipBar />
      </div>

      {/* Map controls — right side */}
      <MapControls mapRef={mapRef} />

      {/* Map style picker — bottom left */}
      <MapStylePicker />

      {/* Legend — bottom left, above style picker */}
      <MapLegend />

      {/* Hover tooltip */}
      {hoverInfo && (
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

      {/* Zoom hint — visible at low zoom */}
      {viewport.zoom < 10 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur border border-border shadow-sm text-xs text-muted-foreground animate-slide-up-fade">
          Zoom in to select properties
        </div>
      )}
    </div>
  );
}
