'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { TILE_LAYERS } from '@/lib/constants';
import { useMapStore } from '@/stores/mapStore';

const LAYER_COLORS: Record<string, string> = {
  flood_zones: '#56B4E9',
  tsunami_zones: '#0D7377',
  liquefaction_zones: '#E69F00',
  coastal_erosion: '#D55E00',
  wind_zones: '#6B7280',
  slope_failure_zones: '#CC79A7',
  school_zones: '#2D6A4F',
  transit_stops: '#0D7377',
  crashes: '#C42D2D',
  district_plan_zones: '#D4863B',
  heritage_sites: '#8B5CF6',
  contaminated_land: '#C42D2D',
  infrastructure_projects: '#0D7377',
  transmission_lines: '#D55E00',
  parcels: '#6B7280',
  building_outlines: '#374151',
  noise_contours: '#E69F00',
  conservation_land: '#2D6A4F',
  osm_amenities: '#0D7377',
  sa2_boundaries: '#6B7280',
  mv_nzdep_choropleth: '#EAB308',
  mv_crime_choropleth: '#EF4444',
  landslide_events: '#F97316',
  landslide_areas: '#F97316',
};

/** Layers with category-based coloring. show multi-dot or multi-fill swatches */
const CATEGORY_COLOR_LAYERS: Record<string, { items: { color: string; label: string }[] }> = {
  building_outlines: {
    items: [
      { color: '#14B8A6', label: 'Residential' },
      { color: '#D97706', label: 'Commercial' },
      { color: '#7C3AED', label: 'Industrial' },
      { color: '#64748B', label: 'Other' },
    ],
  },
  osm_amenities: {
    items: [
      { color: '#2563EB', label: 'Shop' },
      { color: '#DC2626', label: 'Health' },
      { color: '#D97706', label: 'Amenity' },
      { color: '#16A34A', label: 'Leisure' },
      { color: '#9333EA', label: 'Tourism' },
    ],
  },
  crashes: {
    items: [
      { color: '#DC2626', label: 'Fatal' },
      { color: '#EA580C', label: 'Serious' },
      { color: '#D97706', label: 'Minor' },
      { color: '#9CA3AF', label: 'Non-injury' },
    ],
  },
};

/** Layers with data-driven severity gradients. show a gradient swatch in legend.
 * labels[0] is the LEFT (least severe) end, labels[1] is the RIGHT (most severe)
 * end. Copy should make the direction explicit. e.g. "Zone 3 → Zone 1 (most
 * severe)" rather than a bare "Zone 3 → Zone 1" that leaves direction ambiguous. */
const SEVERITY_GRADIENT_LAYERS: Record<string, { colors: string[]; labels: [string, string] }> = {
  mv_nzdep_choropleth: {
    colors: ['#22C55E', '#84CC16', '#EAB308', '#F97316', '#EF4444'],
    labels: ['1 (least)', '10 (most deprived)'],
  },
  mv_crime_choropleth: {
    colors: ['#FDE68A', '#F59E0B', '#F97316', '#EF4444', '#DC2626'],
    labels: ['Low crime', 'High crime'],
  },
  slope_failure_zones: {
    colors: ['#A8D5BA', '#56B4E9', '#E69F00', '#D55E00', '#C42D2D'],
    labels: ['0 (stable)', '100 (failure risk)'],
  },
  liquefaction_zones: {
    colors: ['#56B4E9', '#E69F00', '#D55E00', '#C42D2D'],
    labels: ['Low', 'Very high'],
  },
  tsunami_zones: {
    colors: ['#E69F00', '#D55E00', '#C42D2D'],
    labels: ['Zone 3 (least)', 'Zone 1 (most severe)'],
  },
  wind_zones: {
    colors: ['#56B4E9', '#E69F00', '#D55E00', '#C42D2D'],
    labels: ['Moderate', 'Extreme'],
  },
  noise_contours: {
    colors: ['#A8D5BA', '#56B4E9', '#E69F00', '#D55E00', '#C42D2D'],
    labels: ['< 45 dB', '> 65 dB'],
  },
  coastal_erosion: {
    colors: ['#A8D5BA', '#56B4E9', '#E69F00', '#D55E00', '#C42D2D'],
    labels: ['Low', 'High'],
  },
};

// Layer geometry type for legend swatch
const LAYER_GEOM: Record<string, 'fill' | 'circle' | 'line'> = {
  flood_zones: 'fill', tsunami_zones: 'fill', liquefaction_zones: 'fill',
  slope_failure_zones: 'fill',
  coastal_erosion: 'fill', wind_zones: 'fill', school_zones: 'fill',
  district_plan_zones: 'fill', building_outlines: 'fill', noise_contours: 'fill',
  conservation_land: 'fill',
  transit_stops: 'circle', crashes: 'circle', heritage_sites: 'circle',
  contaminated_land: 'circle', infrastructure_projects: 'circle', osm_amenities: 'circle',
  landslide_events: 'circle',
  parcels: 'line', transmission_lines: 'line', sa2_boundaries: 'line',
  mv_nzdep_choropleth: 'fill', mv_crime_choropleth: 'fill', landslide_areas: 'fill',
};

function GradientSwatch({ colors }: { colors: string[] }) {
  const gradient = `linear-gradient(to right, ${colors.join(', ')})`;
  return (
    <div
      className="w-5 h-3.5 rounded-sm border border-white/20"
      style={{ background: gradient, opacity: 0.75 }}
    />
  );
}

function CategorySwatch({ items, geom }: { items: { color: string; label: string }[]; geom: 'fill' | 'circle' }) {
  return (
    <div className="w-5 h-3.5 flex items-center justify-center gap-px">
      {items.slice(0, 4).map((item, i) =>
        geom === 'circle' ? (
          <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
        ) : (
          <div key={i} className="w-1 h-3 rounded-[1px]" style={{ backgroundColor: item.color, opacity: 0.7 }} />
        )
      )}
    </div>
  );
}

function LegendSwatch({ layerId }: { layerId: string }) {
  // Category-colored layers get a multi-color swatch
  const catInfo = CATEGORY_COLOR_LAYERS[layerId];
  if (catInfo) {
    const geom = LAYER_GEOM[layerId] ?? 'fill';
    return <CategorySwatch items={catInfo.items} geom={geom as 'fill' | 'circle'} />;
  }

  // Severity-driven layers get a gradient swatch
  const severityInfo = SEVERITY_GRADIENT_LAYERS[layerId];
  if (severityInfo) {
    return <GradientSwatch colors={severityInfo.colors} />;
  }

  const color = LAYER_COLORS[layerId] ?? '#6B7280';
  const geom = LAYER_GEOM[layerId] ?? 'fill';

  if (geom === 'circle') {
    return (
      <div className="w-5 h-3.5 flex items-center justify-center">
        <div
          className="w-3 h-3 rounded-full border border-white/50"
          style={{ backgroundColor: color, opacity: 0.8 }}
        />
      </div>
    );
  }

  if (geom === 'line') {
    return (
      <div className="w-5 h-3.5 flex items-center justify-center">
        <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: color }} />
      </div>
    );
  }

  // fill
  return (
    <div
      className="w-5 h-3.5 rounded-sm border border-white/20"
      style={{ backgroundColor: color, opacity: 0.45 }}
    />
  );
}

export function MapLegend() {
  const [expanded, setExpanded] = useState(false);
  const layers = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  const activeLayers = TILE_LAYERS.filter((l) => layers[l.id]);

  if (activeLayers.length === 0) return null;

  // Group by category
  const grouped = activeLayers.reduce<Record<string, typeof activeLayers>>((acc, layer) => {
    const group = layer.group;
    if (!acc[group]) acc[group] = [];
    acc[group].push(layer);
    return acc;
  }, {});

  return (
    <div
      className="absolute bottom-4 left-3 z-30 max-w-[220px]"
      // Legend clicks previously fell through to the map below (MapLibre's
      // click handler fires on the map container), so a user tap-opening
      // the legend also selected whatever was underneath. Stop propagation
      // at the wrapper level so the map never sees the event.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="bg-background/95 backdrop-blur-sm rounded-xl border border-border shadow-md overflow-hidden">
        {/* Header */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            Legend
            <span className="text-xs text-muted-foreground font-normal">
              ({activeLayers.length} layer{activeLayers.length !== 1 ? 's' : ''})
            </span>
          </span>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="px-2.5 pb-2.5 max-h-[200px] sm:max-h-[280px] overflow-y-auto space-y-2">
            <p className="text-[9px] text-muted-foreground leading-snug px-0.5 pt-1">
              Shops, cafés and other labels baked into the satellite basemap
              come from the map provider. Toggle <span className="font-medium">Amenities</span>{' '}
              in the layer picker to see WhareScore&rsquo;s own points of interest.
            </p>
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5 px-0.5">
                  {group}
                </p>
                {items.map((layer) => {
                  const severity = SEVERITY_GRADIENT_LAYERS[layer.id];
                  const catInfo = CATEGORY_COLOR_LAYERS[layer.id];
                  const geom = LAYER_GEOM[layer.id] ?? 'fill';
                  return (
                    <div key={layer.id}>
                      <div
                        className="flex items-center gap-2 py-0.5 px-0.5 rounded hover:bg-muted/50 group cursor-pointer"
                        onClick={() => toggleLayer(layer.id)}
                      >
                        <LegendSwatch layerId={layer.id} />
                        <span className="text-xs flex-1">{layer.label}</span>
                        <X className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-opacity" />
                      </div>
                      {severity && (
                        <div className="flex justify-between px-0.5 ml-7 -mt-0.5 mb-0.5">
                          <span className="text-[9px] text-muted-foreground">{severity.labels[0]}</span>
                          <span className="text-[9px] text-muted-foreground">{severity.labels[1]}</span>
                        </div>
                      )}
                      {catInfo && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0 ml-7 -mt-0.5 mb-0.5">
                          {catInfo.items.map((item) => (
                            <span key={item.label} className="flex items-center gap-1">
                              {geom === 'circle' ? (
                                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                              ) : (
                                <span className="inline-block w-1.5 h-2 rounded-[1px]" style={{ backgroundColor: item.color, opacity: 0.7 }} />
                              )}
                              <span className="text-[9px] text-muted-foreground">{item.label}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
