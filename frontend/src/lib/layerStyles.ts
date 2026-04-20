// lib/layerStyles.ts. MapLibre style definitions for vector tile layers
//
// Each layer served by Martin is a vector tile source. This file defines
// the visual style (fill, circle, line) and color for each layer.
// Point layers with iconImage return [circle(low zoom), symbol(zoom 13+)].
// school_zones returns [fill, dashed-outline, label] for cleaner rendering.
// building_outlines returns [fill, line-outline] with teal color for click affordance.

import type { LayerProps } from 'react-map-gl/maplibre';

/** Geometry type for each tile layer */
type LayerType = 'fill' | 'circle' | 'line';

interface LayerStyleConfig {
  type: LayerType;
  color: string;
  /** Outline / stroke color for fills */
  outlineColor?: string;
  /** Fill opacity for polygon layers */
  fillOpacity?: number;
  /** Circle radius for point layers */
  radius?: number;
  /** Circle stroke width */
  strokeWidth?: number;
  /** Line width */
  lineWidth?: number;
  /** Line dash array */
  dashArray?: number[];
  /** MapLibre image name for icon (point layers only. enables circle+icon dual layers) */
  iconImage?: string;
}

const LAYER_STYLES: Record<string, LayerStyleConfig> = {
  // --- Hazards (polygons). severity-driven colors applied via getLayerStyles() ---
  flood_zones:        { type: 'fill', color: '#56B4E9', outlineColor: '#3A8FBF', fillOpacity: 0.35 },
  tsunami_zones:      { type: 'fill', color: '#0D7377', outlineColor: '#0A5C5F', fillOpacity: 0.32 },
  liquefaction_zones: { type: 'fill', color: '#E69F00', outlineColor: '#C48700', fillOpacity: 0.30 },
  slope_failure_zones: { type: 'fill', color: '#CC79A7', outlineColor: '#A8628A', fillOpacity: 0.30 },
  coastal_erosion:    { type: 'fill', color: '#D55E00', outlineColor: '#B04D00', fillOpacity: 0.30 },
  wind_zones:         { type: 'fill', color: '#9CA3AF', outlineColor: '#6B7280', fillOpacity: 0.25 },
  landslide_areas:    { type: 'fill', color: '#F97316', outlineColor: '#EA580C', fillOpacity: 0.28 },
  // Council flood/tsunami/liquefaction detail layers (national expansion)
  flood_hazard:       { type: 'fill', color: '#3B82F6', outlineColor: '#2563EB', fillOpacity: 0.30 },
  tsunami_hazard:     { type: 'fill', color: '#0D7377', outlineColor: '#0A5C5F', fillOpacity: 0.30 },
  fault_zones:        { type: 'fill', color: '#DC2626', outlineColor: '#B91C1C', fillOpacity: 0.25 },
  flood_extent:       { type: 'fill', color: '#60A5FA', outlineColor: '#3B82F6', fillOpacity: 0.25 },
  landslide_susceptibility: { type: 'fill', color: '#D97706', outlineColor: '#B45309', fillOpacity: 0.25 },
  // GNS national fault layers
  active_faults:      { type: 'line', color: '#DC2626', lineWidth: 2.5 },
  fault_avoidance_zones: { type: 'fill', color: '#FCA5A5', outlineColor: '#DC2626', fillOpacity: 0.20 },

  // --- Landslide events (points) ---
  landslide_events:   { type: 'circle', color: '#F97316', radius: 5, strokeWidth: 1.5 },

  // --- Transport (points). icons at zoom 13+ ---
  transit_stops:      { type: 'circle', color: '#0D7377', radius: 5, strokeWidth: 2, iconImage: 'icon-transit' },
  crashes:            { type: 'circle', color: '#C42D2D', radius: 4, strokeWidth: 1.5, iconImage: 'icon-crash' },

  // --- Planning ---
  district_plan_zones:     { type: 'fill', color: '#D4863B', outlineColor: '#B06E2D', fillOpacity: 0.20 },
  heritage_sites:          { type: 'circle', color: '#8B5CF6', radius: 6, strokeWidth: 2, iconImage: 'icon-heritage' },
  contaminated_land:       { type: 'fill', color: '#C42D2D', outlineColor: '#9E2424', fillOpacity: 0.28 },
  infrastructure_projects: { type: 'circle', color: '#0D7377', radius: 7, strokeWidth: 2.5, iconImage: 'icon-infrastructure' },
  transmission_lines:      { type: 'line', color: '#F97316', lineWidth: 3, dashArray: [4, 2] },

  // --- Property ---
  parcels:           { type: 'line', color: '#CBD5E1', lineWidth: 0.5 },
  building_outlines: { type: 'fill', color: '#14B8A6', outlineColor: '#0D9488', fillOpacity: 0.08 },

  // --- More ---
  noise_contours:    { type: 'fill', color: '#E69F00', outlineColor: '#C48700', fillOpacity: 0.25 },
  conservation_land: { type: 'fill', color: '#2D6A4F', outlineColor: '#1B4D3A', fillOpacity: 0.28 },
  // osm_amenities uses custom color-by-category logic in getLayerStyles()
  osm_amenities:     { type: 'circle', color: '#D4863B', radius: 4.5, strokeWidth: 1.5 },
  sa2_boundaries:    { type: 'line', color: '#94A3B8', lineWidth: 1.5, dashArray: [6, 3] },
};

// ---------------------------------------------------------------------------
// Severity-driven color ramps for hazard polygon layers.
// Each expression uses MapLibre's data-driven styling to color polygons
// by their severity/classification property. bolder = more intense risk.
// Colors go from cool/light (low risk) → warm/bold (high risk).
// ---------------------------------------------------------------------------

/** 5-stop risk palette: very-low → very-high */
const RISK_RAMP = {
  veryLow: '#A8D5BA',  // soft green
  low:     '#56B4E9',  // sky blue
  moderate:'#E69F00',  // amber
  high:    '#D55E00',  // deep orange
  veryHigh:'#C42D2D',  // bold red
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeverityExpr = any;

/**
 * Slope failure: susceptibility column. "Very Low" / "Low" / "Medium" / "High" / "Very High"
 * Maps to 0-100 risk scale (5, 20, 45, 75, 90)
 */
const SLOPE_FAILURE_FILL: SeverityExpr = [
  'match', ['get', 'susceptibility'],
  'Very Low',  RISK_RAMP.veryLow,
  'Low',       RISK_RAMP.low,
  'Medium',    RISK_RAMP.moderate,
  'High',      RISK_RAMP.high,
  'Very High', RISK_RAMP.veryHigh,
  '#CC79A7', // fallback
];
const SLOPE_FAILURE_OPACITY: SeverityExpr = [
  'match', ['get', 'susceptibility'],
  'Very Low',  0.12,
  'Low',       0.18,
  'Medium',    0.25,
  'High',      0.35,
  'Very High', 0.50,
  0.20,
];

/**
 * Liquefaction: liquefaction column. "Low" / "Moderate" / "High" / "Very High"
 */
const LIQUEFACTION_FILL: SeverityExpr = [
  'match', ['get', 'liquefaction'],
  'Low',       RISK_RAMP.low,
  'Moderate',  RISK_RAMP.moderate,
  'High',      RISK_RAMP.high,
  'Very High', RISK_RAMP.veryHigh,
  '#E69F00',
];
const LIQUEFACTION_OPACITY: SeverityExpr = [
  'match', ['get', 'liquefaction'],
  'Low',       0.14,
  'Moderate',  0.22,
  'High',      0.32,
  'Very High', 0.45,
  0.20,
];

/**
 * Tsunami: zone_class column. 1 (highest risk) / 2 / 3 (lowest)
 */
const TSUNAMI_FILL: SeverityExpr = [
  'match', ['get', 'zone_class'],
  1, RISK_RAMP.veryHigh,
  2, RISK_RAMP.high,
  3, RISK_RAMP.moderate,
  '#0D7377',
];
const TSUNAMI_OPACITY: SeverityExpr = [
  'match', ['get', 'zone_class'],
  1, 0.40,
  2, 0.28,
  3, 0.18,
  0.22,
];

/**
 * Wind zones: zone_name. "M" / "H" / "VH" / "EH" / "SED"
 */
const WIND_FILL: SeverityExpr = [
  'match', ['get', 'zone_name'],
  'M',   RISK_RAMP.low,
  'H',   RISK_RAMP.moderate,
  'VH',  RISK_RAMP.high,
  'EH',  RISK_RAMP.veryHigh,
  'SED', RISK_RAMP.veryHigh,
  '#9CA3AF',
];
const WIND_OPACITY: SeverityExpr = [
  'match', ['get', 'zone_name'],
  'M',   0.10,
  'H',   0.18,
  'VH',  0.28,
  'EH',  0.40,
  'SED', 0.40,
  0.15,
];

/**
 * Noise contours: laeq24h. continuous dB scale (50–70+)
 */
const NOISE_FILL: SeverityExpr = [
  'interpolate', ['linear'], ['get', 'laeq24h'],
  45, RISK_RAMP.veryLow,
  50, RISK_RAMP.low,
  55, RISK_RAMP.moderate,
  60, RISK_RAMP.high,
  65, RISK_RAMP.veryHigh,
];
const NOISE_OPACITY: SeverityExpr = [
  'interpolate', ['linear'], ['get', 'laeq24h'],
  45, 0.08,
  50, 0.12,
  55, 0.20,
  60, 0.30,
  65, 0.42,
];

/**
 * Coastal erosion: csi_in. CSI index (numeric, 0–100+)
 */
const COASTAL_FILL: SeverityExpr = [
  'interpolate', ['linear'], ['get', 'csi_in'],
  0,   RISK_RAMP.veryLow,
  25,  RISK_RAMP.low,
  50,  RISK_RAMP.moderate,
  75,  RISK_RAMP.high,
  100, RISK_RAMP.veryHigh,
];
const COASTAL_OPACITY: SeverityExpr = [
  'interpolate', ['linear'], ['get', 'csi_in'],
  0,   0.12,
  25,  0.18,
  50,  0.25,
  75,  0.35,
  100, 0.48,
];

/** Map of layer IDs → data-driven fill-color and fill-opacity expressions */
const SEVERITY_EXPRESSIONS: Record<string, { fill: SeverityExpr; opacity: SeverityExpr }> = {
  slope_failure_zones: { fill: SLOPE_FAILURE_FILL, opacity: SLOPE_FAILURE_OPACITY },
  liquefaction_zones:  { fill: LIQUEFACTION_FILL,  opacity: LIQUEFACTION_OPACITY },
  tsunami_zones:       { fill: TSUNAMI_FILL,       opacity: TSUNAMI_OPACITY },
  wind_zones:          { fill: WIND_FILL,          opacity: WIND_OPACITY },
  noise_contours:      { fill: NOISE_FILL,         opacity: NOISE_OPACITY },
  coastal_erosion:     { fill: COASTAL_FILL,        opacity: COASTAL_OPACITY },
};

function makeCircleLayer(layerId: string, config: LayerStyleConfig, maxzoom?: number): LayerProps {
  return {
    id: `layer-${layerId}`,
    source: `source-${layerId}`,
    'source-layer': layerId,
    type: 'circle' as const,
    ...(maxzoom !== undefined ? { maxzoom } : {}),
    paint: {
      'circle-color': config.color,
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, (config.radius ?? 4) * 0.5,
        14, config.radius ?? 4,
        18, (config.radius ?? 4) * 1.5,
      ],
      'circle-opacity': 0.85,
      'circle-stroke-width': config.strokeWidth ?? 1,
      'circle-stroke-color': '#ffffff',
    },
  } as LayerProps;
}

function makeIconLayer(layerId: string, config: LayerStyleConfig): LayerProps {
  return {
    id: `layer-${layerId}-icon`,
    source: `source-${layerId}`,
    'source-layer': layerId,
    type: 'symbol' as const,
    minzoom: 13,
    layout: {
      'icon-image': config.iconImage!,
      'icon-size': 1,
      'icon-allow-overlap': true,
      'icon-anchor': 'center',
    },
  } as LayerProps;
}

/**
 * Build all MapLibre Layer props for a given tile layer.
 * Returns multiple layers for:
 *   - point layers with icons (circle at low zoom + symbol at zoom 13+)
 *   - school_zones (subtle fill + dashed outline + name labels)
 *   - building_outlines (subtle fill + teal line outline)
 */
export function getLayerStyles(layerId: string): LayerProps[] {
  // Special: SA2 boundaries. show suburb/locality labels at low zoom, hide at zoom 15+
  if (layerId === 'sa2_boundaries') {
    return [
      {
        id: 'layer-sa2_boundaries',
        source: 'source-sa2_boundaries',
        'source-layer': 'sa2_boundaries',
        type: 'line' as const,
        paint: {
          'line-color': '#6B7280',
          'line-width': 1.5,
          'line-dasharray': [6, 3],
          'line-opacity': 0.5,
        },
      },
      {
        id: 'layer-sa2_boundaries-label',
        source: 'source-sa2_boundaries',
        'source-layer': 'sa2_boundaries',
        type: 'symbol' as const,
        minzoom: 8,
        maxzoom: 15,
        layout: {
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
        },
        paint: {
          'text-color': '#4B5563',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.5,
          'text-opacity': [
            'interpolate', ['linear'], ['zoom'],
            8, 0.5,
            12, 0.8,
            15, 0,
          ],
        },
      },
    ];
  }

  // Special: school zones. very subtle fill so underlying basemap shows through,
  // dashed green outline for zone boundary, school name labels at zoom 13+
  if (layerId === 'school_zones') {
    return [
      {
        id: 'layer-school_zones',
        source: 'source-school_zones',
        'source-layer': 'school_zones',
        type: 'fill' as const,
        paint: {
          'fill-color': '#2D6A4F',
          'fill-opacity': 0.06,
        },
      },
      {
        id: 'layer-school_zones-outline',
        source: 'source-school_zones',
        'source-layer': 'school_zones',
        type: 'line' as const,
        paint: {
          'line-color': '#2D6A4F',
          'line-width': 1.5,
          'line-dasharray': [4, 3],
          'line-opacity': 0.7,
        },
      },
      {
        id: 'layer-school_zones-label',
        source: 'source-school_zones',
        'source-layer': 'school_zones',
        type: 'symbol' as const,
        minzoom: 14,
        layout: {
          'text-field': ['coalesce', ['get', 'school_name'], ['get', 'name'], ''],
          'text-size': 11,
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-anchor': 'center',
          'text-max-width': 8,
          'symbol-placement': 'point',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#1B4D3A',
          'text-halo-color': 'rgba(255,255,255,0.85)',
          'text-halo-width': 1.5,
        },
      } as LayerProps,
    ];
  }

  // Special: building outlines. color-coded by use type
  // Residential = teal, Commercial = amber, Other = slate
  // Boosted opacity for better visibility
  if (layerId === 'building_outlines') {
    const fillColor: SeverityExpr = [
      'match', ['get', 'use'],
      'Residential',  '#14B8A6',  // teal
      'Commercial',   '#D97706',  // amber
      'Industrial',   '#7C3AED',  // purple
      '#64748B',                  // slate fallback
    ];
    const outlineColor: SeverityExpr = [
      'match', ['get', 'use'],
      'Residential',  '#0D9488',
      'Commercial',   '#B45309',
      'Industrial',   '#6D28D9',
      '#475569',
    ];
    return [
      {
        id: 'layer-building_outlines',
        source: 'source-building_outlines',
        'source-layer': 'building_outlines',
        type: 'fill' as const,
        paint: {
          'fill-color': fillColor,
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            13, 0.40,
            15, 0.30,
            17, 0.22,
          ],
          'fill-outline-color': 'transparent',
        },
      },
      {
        id: 'layer-building_outlines-outline',
        source: 'source-building_outlines',
        'source-layer': 'building_outlines',
        type: 'line' as const,
        minzoom: 14,
        paint: {
          'line-color': outlineColor,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            14, 0.8,
            16, 1.8,
            18, 2.8,
          ],
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            14, 0.5,
            16, 0.8,
            18, 0.9,
          ],
        },
      },
    ];
  }

  // Special: district plan zones. color-coded by zone type
  // Zone names are mixed (numeric codes + text), so we use case expressions
  // to pattern-match into categories: Residential, Commercial, Industrial, etc.
  if (layerId === 'district_plan_zones') {
    const fillColor: SeverityExpr = [
      'case',
      ['any',
        ['in', 'Residential', ['get', 'zone_name']],
        ['in', 'residential', ['get', 'zone_name']],
        ['in', 'Living', ['get', 'zone_name']],
        ['in', 'Township', ['get', 'zone_name']],
      ], '#F59E0B',  // amber. residential
      ['any',
        ['in', 'Business', ['get', 'zone_name']],
        ['in', 'BUSINESS', ['get', 'zone_name']],
        ['in', 'Commercial', ['get', 'zone_name']],
        ['in', 'Centre', ['get', 'zone_name']],
        ['in', 'Retail', ['get', 'zone_name']],
        ['in', 'Mixed Use', ['get', 'zone_name']],
      ], '#3B82F6',  // blue. commercial/business
      ['any',
        ['in', 'Industrial', ['get', 'zone_name']],
        ['in', 'INDUSTRIAL', ['get', 'zone_name']],
        ['in', 'Airport', ['get', 'zone_name']],
        ['in', 'AIRPORT', ['get', 'zone_name']],
        ['in', 'Port', ['get', 'zone_name']],
      ], '#7C3AED',  // purple. industrial
      ['any',
        ['in', 'Rural', ['get', 'zone_name']],
        ['in', 'RURAL', ['get', 'zone_name']],
        ['in', 'Coastal', ['get', 'zone_name']],
      ], '#16A34A',  // green. rural/coastal
      ['any',
        ['in', 'Open Space', ['get', 'zone_name']],
        ['in', 'Recreation', ['get', 'zone_name']],
        ['in', 'Conservation', ['get', 'zone_name']],
        ['in', 'Reserve', ['get', 'zone_name']],
      ], '#059669',  // emerald. open space
      ['any',
        ['in', 'Road', ['get', 'zone_name']],
        ['in', 'Rail', ['get', 'zone_name']],
        ['in', 'Corridor', ['get', 'zone_name']],
      ], '#6B7280',  // gray. transport corridors
      '#D4863B',  // fallback. original orange for numeric/unknown codes
    ];
    const outlineColor: SeverityExpr = [
      'case',
      ['any', ['in', 'Residential', ['get', 'zone_name']], ['in', 'residential', ['get', 'zone_name']], ['in', 'Living', ['get', 'zone_name']], ['in', 'Township', ['get', 'zone_name']]], '#D97706',
      ['any', ['in', 'Business', ['get', 'zone_name']], ['in', 'BUSINESS', ['get', 'zone_name']], ['in', 'Commercial', ['get', 'zone_name']], ['in', 'Centre', ['get', 'zone_name']], ['in', 'Retail', ['get', 'zone_name']], ['in', 'Mixed Use', ['get', 'zone_name']]], '#2563EB',
      ['any', ['in', 'Industrial', ['get', 'zone_name']], ['in', 'INDUSTRIAL', ['get', 'zone_name']], ['in', 'Airport', ['get', 'zone_name']], ['in', 'AIRPORT', ['get', 'zone_name']], ['in', 'Port', ['get', 'zone_name']]], '#6D28D9',
      ['any', ['in', 'Rural', ['get', 'zone_name']], ['in', 'RURAL', ['get', 'zone_name']], ['in', 'Coastal', ['get', 'zone_name']]], '#15803D',
      ['any', ['in', 'Open Space', ['get', 'zone_name']], ['in', 'Recreation', ['get', 'zone_name']], ['in', 'Conservation', ['get', 'zone_name']], ['in', 'Reserve', ['get', 'zone_name']]], '#047857',
      ['any', ['in', 'Road', ['get', 'zone_name']], ['in', 'Rail', ['get', 'zone_name']], ['in', 'Corridor', ['get', 'zone_name']]], '#4B5563',
      '#B06E2D',
    ];
    return [
      {
        id: 'layer-district_plan_zones',
        source: 'source-district_plan_zones',
        'source-layer': 'district_plan_zones',
        type: 'fill' as const,
        paint: {
          'fill-color': fillColor,
          'fill-opacity': 0.18,
        },
      },
      {
        id: 'layer-district_plan_zones-outline',
        source: 'source-district_plan_zones',
        'source-layer': 'district_plan_zones',
        type: 'line' as const,
        paint: {
          'line-color': outlineColor,
          'line-width': 1,
          'line-opacity': 0.5,
        },
      },
    ];
  }

  // Special: crashes. severity-driven colors and sizes
  // Fatal = large red, Serious = orange, Minor = amber, Non-injury = gray
  if (layerId === 'crashes') {
    const colorExpr: SeverityExpr = [
      'match', ['get', 'crash_severity'],
      'Fatal Crash',      '#DC2626',  // red
      'Serious Crash',    '#EA580C',  // deep orange
      'Minor Crash',      '#D97706',  // amber
      'Non-Injury Crash', '#9CA3AF',  // gray
      '#C42D2D',                      // fallback
    ];
    const radiusExpr: SeverityExpr = [
      'interpolate', ['linear'], ['zoom'],
      10, ['match', ['get', 'crash_severity'],
        'Fatal Crash', 4, 'Serious Crash', 3, 'Minor Crash', 2, 'Non-Injury Crash', 1.5, 2],
      14, ['match', ['get', 'crash_severity'],
        'Fatal Crash', 7, 'Serious Crash', 5.5, 'Minor Crash', 4, 'Non-Injury Crash', 3, 4],
      18, ['match', ['get', 'crash_severity'],
        'Fatal Crash', 10, 'Serious Crash', 8, 'Minor Crash', 6, 'Non-Injury Crash', 4, 5],
    ];
    const opacityExpr: SeverityExpr = [
      'match', ['get', 'crash_severity'],
      'Fatal Crash',      0.95,
      'Serious Crash',    0.85,
      'Minor Crash',      0.65,
      'Non-Injury Crash', 0.45,
      0.7,
    ];
    return [
      {
        id: 'layer-crashes',
        source: 'source-crashes',
        'source-layer': 'crashes',
        type: 'circle' as const,
        paint: {
          'circle-color': colorExpr,
          'circle-radius': radiusExpr,
          'circle-opacity': opacityExpr,
          'circle-stroke-width': ['match', ['get', 'crash_severity'],
            'Fatal Crash', 2, 'Serious Crash', 1.5, 1],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': ['match', ['get', 'crash_severity'],
            'Fatal Crash', 0.9, 'Serious Crash', 0.7, 0.5],
        },
        // Sort: fatal on top, then serious, then minor, non-injury at bottom
        layout: {
          'circle-sort-key': ['match', ['get', 'crash_severity'],
            'Fatal Crash', 4, 'Serious Crash', 3, 'Minor Crash', 2, 'Non-Injury Crash', 1, 0],
        },
      } as LayerProps,
    ];
  }

  // Special: OSM amenities. color-coded circles by category
  if (layerId === 'osm_amenities') {
    const colorExpr: SeverityExpr = [
      'match', ['get', 'category'],
      'shop',       '#2563EB',  // blue. retail (supermarket, pharmacy, etc.)
      'healthcare', '#DC2626',  // red. health
      'amenity',    '#D97706',  // amber. general amenities (cafe, restaurant, etc.)
      'leisure',    '#16A34A',  // green. parks, sports
      'tourism',    '#9333EA',  // purple. attractions
      '#78716C',                // stone fallback
    ];
    return [
      {
        id: 'layer-osm_amenities',
        source: 'source-osm_amenities',
        'source-layer': 'osm_amenities',
        type: 'circle' as const,
        paint: {
          'circle-color': colorExpr,
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            13, 2.5,
            15, 4,
            18, 6,
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      } as LayerProps,
    ];
  }

  // Special: NZDep choropleth. green (decile 1) to red (decile 10)
  if (layerId === 'mv_nzdep_choropleth') {
    const fillColor: SeverityExpr = [
      'interpolate', ['linear'], ['get', 'nzdep'],
      1, '#22C55E',   // green. least deprived
      3, '#84CC16',   // lime
      5, '#EAB308',   // yellow
      7, '#F97316',   // orange
      9, '#EF4444',   // red
      10, '#DC2626',  // dark red. most deprived
    ];
    return [
      {
        id: 'layer-mv_nzdep_choropleth',
        source: 'source-mv_nzdep_choropleth',
        'source-layer': 'mv_nzdep_choropleth',
        type: 'fill' as const,
        paint: {
          'fill-color': fillColor,
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            10, 0.25,
            14, 0.20,
            16, 0.12,
          ],
          'fill-outline-color': 'transparent',
        },
      } as LayerProps,
    ];
  }

  // Special: Crime density choropleth. transparent (no crime) to red (high crime)
  if (layerId === 'mv_crime_choropleth') {
    const fillColor: SeverityExpr = [
      'match', ['get', 'crime_level'],
      0, 'transparent',
      1, '#FDE68A',    // pale yellow. very low
      2, '#F59E0B',    // amber. low
      3, '#F97316',    // orange. moderate
      4, '#EF4444',    // red. high
      5, '#DC2626',    // dark red. very high
      'transparent',
    ];
    return [
      {
        id: 'layer-mv_crime_choropleth',
        source: 'source-mv_crime_choropleth',
        'source-layer': 'mv_crime_choropleth',
        type: 'fill' as const,
        paint: {
          'fill-color': fillColor,
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            10, 0.30,
            14, 0.22,
            16, 0.15,
          ],
          'fill-outline-color': 'transparent',
        },
      } as LayerProps,
    ];
  }

  // Special: parcels. fade in at high zoom, invisible when zoomed out
  if (layerId === 'parcels') {
    return [
      {
        id: 'layer-parcels',
        source: 'source-parcels',
        'source-layer': 'parcels',
        type: 'line' as const,
        minzoom: 15,
        paint: {
          'line-color': '#FFFFFF',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            15, 0.3,
            17, 0.5,
            18, 0.8,
          ],
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            15, 0.3,
            17, 0.6,
            18, 0.8,
          ],
        },
      } as LayerProps,
    ];
  }

  const config = LAYER_STYLES[layerId];
  if (!config) return [];

  const base = {
    id: `layer-${layerId}`,
    source: `source-${layerId}`,
    'source-layer': layerId,
  };

  switch (config.type) {
    case 'fill': {
      const severity = SEVERITY_EXPRESSIONS[layerId];
      return [
        {
          ...base,
          type: 'fill' as const,
          paint: {
            'fill-color': severity ? severity.fill : config.color,
            'fill-opacity': severity ? severity.opacity : (config.fillOpacity ?? 0.25),
            'fill-outline-color': config.outlineColor ?? config.color,
          },
        },
      ];
    }

    case 'circle':
      if (config.iconImage) {
        // Low-zoom circle (minzoom controlled by Source) → icon at zoom 13+
        return [
          makeCircleLayer(layerId, config, 13),
          makeIconLayer(layerId, config),
        ];
      }
      return [makeCircleLayer(layerId, config)];

    case 'line': {
      const paint: Record<string, unknown> = {
        'line-color': config.color,
        'line-width': config.lineWidth ?? 1.5,
        'line-opacity': 0.8,
      };
      if (config.dashArray) paint['line-dasharray'] = config.dashArray;
      return [
        {
          ...base,
          type: 'line' as const,
          paint,
          layout: {},
        } as LayerProps,
      ];
    }
  }
}

/**
 * Legacy single-layer accessor. kept for non-toggled layers (addresses-click).
 */
export function getLayerStyle(layerId: string): LayerProps | null {
  return getLayerStyles(layerId)[0] ?? null;
}

/**
 * Build the tile URL for a Martin vector tile source.
 * Must be absolute. MapLibre fetches tiles inside a Web Worker with no window.location.
 */
export function getTileUrl(layerId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/tiles/${layerId}/{z}/{x}/{y}`;
}
