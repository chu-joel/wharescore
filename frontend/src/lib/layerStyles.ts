// lib/layerStyles.ts — MapLibre style definitions for vector tile layers
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
  /** MapLibre image name for icon (point layers only — enables circle+icon dual layers) */
  iconImage?: string;
}

const LAYER_STYLES: Record<string, LayerStyleConfig> = {
  // --- Hazards (polygons) — severity-driven colors applied via getLayerStyles() ---
  flood_zones:        { type: 'fill', color: '#56B4E9', outlineColor: '#3A8FBF', fillOpacity: 0.22 },
  tsunami_zones:      { type: 'fill', color: '#0D7377', outlineColor: '#0A5C5F', fillOpacity: 0.22 },
  liquefaction_zones: { type: 'fill', color: '#E69F00', outlineColor: '#C48700', fillOpacity: 0.20 },
  slope_failure_zones: { type: 'fill', color: '#CC79A7', outlineColor: '#A8628A', fillOpacity: 0.20 },
  coastal_erosion:    { type: 'fill', color: '#D55E00', outlineColor: '#B04D00', fillOpacity: 0.20 },
  wind_zones:         { type: 'fill', color: '#9CA3AF', outlineColor: '#6B7280', fillOpacity: 0.15 },

  // --- Transport (points) — icons at zoom 13+ ---
  transit_stops:      { type: 'circle', color: '#0D7377', radius: 4, strokeWidth: 1.5, iconImage: 'icon-transit' },
  crashes:            { type: 'circle', color: '#C42D2D', radius: 3, strokeWidth: 1,   iconImage: 'icon-crash' },

  // --- Planning ---
  district_plan_zones:     { type: 'fill', color: '#D4863B', outlineColor: '#B06E2D', fillOpacity: 0.12 },
  heritage_sites:          { type: 'circle', color: '#8B5CF6', radius: 5, strokeWidth: 1.5, iconImage: 'icon-heritage' },
  contaminated_land:       { type: 'fill', color: '#C42D2D', outlineColor: '#9E2424', fillOpacity: 0.18 },
  infrastructure_projects: { type: 'circle', color: '#0D7377', radius: 6, strokeWidth: 2, iconImage: 'icon-infrastructure' },
  transmission_lines:      { type: 'line', color: '#D55E00', lineWidth: 2.5, dashArray: [4, 2] },

  // --- Property — teal building outlines signal interactivity ---
  parcels:           { type: 'line', color: '#9CA3AF', lineWidth: 0.8 },
  building_outlines: { type: 'fill', color: '#14B8A6', outlineColor: '#0D9488', fillOpacity: 0.08 },

  // --- More ---
  noise_contours:    { type: 'fill', color: '#E69F00', outlineColor: '#C48700', fillOpacity: 0.15 },
  conservation_land: { type: 'fill', color: '#2D6A4F', outlineColor: '#1B4D3A', fillOpacity: 0.18 },
  osm_amenities:     { type: 'circle', color: '#D4863B', radius: 3.5, strokeWidth: 1, iconImage: 'icon-amenity' },
  sa2_boundaries:    { type: 'line', color: '#6B7280', lineWidth: 1.5, dashArray: [6, 3] },
};

// ---------------------------------------------------------------------------
// Severity-driven color ramps for hazard polygon layers.
// Each expression uses MapLibre's data-driven styling to color polygons
// by their severity/classification property — bolder = more intense risk.
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
 * Slope failure: susceptibility column — "Very Low" / "Low" / "Medium" / "High" / "Very High"
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
 * Liquefaction: liquefaction column — "Low" / "Moderate" / "High" / "Very High"
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
 * Tsunami: zone_class column — 1 (highest risk) / 2 / 3 (lowest)
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
 * Wind zones: zone_name — "M" / "H" / "VH" / "EH" / "SED"
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
 * Noise contours: laeq24h — continuous dB scale (50–70+)
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
 * Coastal erosion: csi_in — CSI index (numeric, 0–100+)
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
  // Special: SA2 boundaries — show suburb/locality labels at low zoom, hide at zoom 15+
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

  // Special: school zones — very subtle fill so underlying basemap shows through,
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

  // Special: building outlines — subtle teal fill + visible teal line outline at high zoom
  // The teal color distinguishes clickable buildings from the neutral basemap
  if (layerId === 'building_outlines') {
    return [
      {
        id: 'layer-building_outlines',
        source: 'source-building_outlines',
        'source-layer': 'building_outlines',
        type: 'fill' as const,
        paint: {
          'fill-color': '#14B8A6',
          'fill-opacity': 0.08,
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
          'line-color': '#0D9488',
          'line-width': 1.5,
          'line-opacity': 0.65,
        },
      },
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
 * Legacy single-layer accessor — kept for non-toggled layers (addresses-click).
 */
export function getLayerStyle(layerId: string): LayerProps | null {
  return getLayerStyles(layerId)[0] ?? null;
}

/**
 * Build the tile URL for a Martin vector tile source.
 * Must be absolute — MapLibre fetches tiles inside a Web Worker with no window.location.
 */
export function getTileUrl(layerId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/tiles/${layerId}/{z}/{x}/{y}`;
}
