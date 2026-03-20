/**
 * Custom vector label layers — Google Maps-style white text with dark outlines.
 * Uses OpenFreeMap vector tiles (OpenMapTiles schema, free, no API key).
 *
 * Layer hierarchy (low zoom → high zoom):
 *   country → state → city → town → suburb → street → water → POI
 */
import type { LayerProps } from 'react-map-gl/maplibre';

export const LABEL_SOURCE_ID = 'source-ofm-labels';

/** OpenFreeMap direct tile URL (avoids TileJSON fetch which can fail with CORS/timing) */
export const LABEL_TILE_URL = 'https://tiles.openfreemap.org/planet/20260311_001001_pt/{z}/{x}/{y}.pbf';

// ---------------------------------------------------------------------------
// Shared paint — white text, dark semi-transparent halo (like Google satellite)
// ---------------------------------------------------------------------------
const WHITE_ON_DARK = {
  'text-color': '#FFFFFF',
  'text-halo-color': 'rgba(0, 0, 0, 0.75)',
  'text-halo-width': 1.5,
  'text-halo-blur': 0.5,
} as const;

// For light basemaps — dark text, white halo
const DARK_ON_LIGHT = {
  'text-color': '#333333',
  'text-halo-color': 'rgba(255, 255, 255, 0.9)',
  'text-halo-width': 1.5,
  'text-halo-blur': 0.5,
} as const;

const FONT_REGULAR = ['Open Sans Regular', 'Arial Unicode MS Regular'];
const FONT_BOLD = ['Open Sans Semibold', 'Arial Unicode MS Bold'];

// ---------------------------------------------------------------------------
// Label layers (rendered bottom-to-top in this order)
// ---------------------------------------------------------------------------

function makeLabelLayers(paint: Record<string, unknown>): LayerProps[] {
  return [
    // --- Country labels (zoom 2-5) ---
    {
      id: 'ofm-label-country',
      source: LABEL_SOURCE_ID,
      'source-layer': 'place',
      type: 'symbol',
      minzoom: 2,
      maxzoom: 5,
      filter: ['==', ['get', 'class'], 'country'],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 11, 5, 16],
        'text-font': FONT_BOLD,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.15,
        'text-max-width': 8,
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-padding': 4,
      },
      paint: {
        ...paint,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.7, 4, 1, 5, 0],
      },
    } as LayerProps,

    // --- State/region labels (zoom 4-7) ---
    {
      id: 'ofm-label-state',
      source: LABEL_SOURCE_ID,
      'source-layer': 'place',
      type: 'symbol',
      minzoom: 4,
      maxzoom: 8,
      filter: ['==', ['get', 'class'], 'state'],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 7, 13],
        'text-font': FONT_BOLD,
        'text-letter-spacing': 0.08,
        'text-max-width': 8,
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-padding': 4,
      },
      paint: {
        ...paint,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 6, 0.9, 8, 0],
      },
    } as LayerProps,

    // --- City labels (zoom 5-12) ---
    {
      id: 'ofm-label-city',
      source: LABEL_SOURCE_ID,
      'source-layer': 'place',
      type: 'symbol',
      minzoom: 5,
      maxzoom: 13,
      filter: ['==', ['get', 'class'], 'city'],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 8, 14, 12, 18],
        'text-font': FONT_BOLD,
        'text-max-width': 10,
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-padding': 6,
      },
      paint: {
        ...paint,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 7, 1, 12, 0.9, 13, 0],
      },
    } as LayerProps,

    // --- Town labels (zoom 8-14) ---
    {
      id: 'ofm-label-town',
      source: LABEL_SOURCE_ID,
      'source-layer': 'place',
      type: 'symbol',
      minzoom: 8,
      maxzoom: 15,
      filter: ['any', ['==', ['get', 'class'], 'town'], ['==', ['get', 'class'], 'village']],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 11, 12, 14, 14],
        'text-font': FONT_BOLD,
        'text-max-width': 8,
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-padding': 4,
      },
      paint: {
        ...paint,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 10, 0.9, 14, 0.8, 15, 0],
      },
    } as LayerProps,

    // --- Suburb/neighbourhood labels (zoom 11-16) ---
    {
      id: 'ofm-label-suburb',
      source: LABEL_SOURCE_ID,
      'source-layer': 'place',
      type: 'symbol',
      minzoom: 11,
      maxzoom: 17,
      filter: ['any', ['==', ['get', 'class'], 'suburb'], ['==', ['get', 'class'], 'neighbourhood'], ['==', ['get', 'class'], 'quarter']],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9, 13, 11, 16, 13],
        'text-font': FONT_REGULAR,
        'text-max-width': 8,
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-padding': 3,
      },
      paint: {
        ...paint,
        'text-halo-width': 1.2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 13, 0.85, 16, 0.7, 17, 0],
      },
    } as LayerProps,

    // --- Water body labels (zoom 6-18) ---
    {
      id: 'ofm-label-water',
      source: LABEL_SOURCE_ID,
      'source-layer': 'water_name',
      type: 'symbol',
      minzoom: 6,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 10, 13, 14, 14],
        'text-font': FONT_REGULAR,
        'text-letter-spacing': 0.2,
        'text-max-width': 10,
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-padding': 6,
      },
      paint: {
        ...paint,
        'text-color': '#B0D4F1',
        'text-halo-color': 'rgba(0, 0, 0, 0.6)',
        'text-halo-width': 1.2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 9, 0.7, 14, 0.6],
      },
    } as LayerProps,

    // --- Street labels (zoom 13+) — follow road lines ---
    {
      id: 'ofm-label-road-major',
      source: LABEL_SOURCE_ID,
      'source-layer': 'transportation_name',
      type: 'symbol',
      minzoom: 12,
      filter: ['any', ['==', ['get', 'class'], 'motorway'], ['==', ['get', 'class'], 'trunk'], ['==', ['get', 'class'], 'primary'], ['==', ['get', 'class'], 'secondary']],
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ''],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 15, 12, 18, 14],
        'text-font': FONT_REGULAR,
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
        'text-anchor': 'center',
        'text-max-angle': 30,
        'text-allow-overlap': false,
        'text-padding': 2,
        'symbol-spacing': 300,
      },
      paint: {
        ...paint,
        'text-halo-width': 1.8,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 14, 0.9],
      },
    } as LayerProps,

    {
      id: 'ofm-label-road-minor',
      source: LABEL_SOURCE_ID,
      'source-layer': 'transportation_name',
      type: 'symbol',
      minzoom: 14,
      filter: ['any', ['==', ['get', 'class'], 'tertiary'], ['==', ['get', 'class'], 'minor'], ['==', ['get', 'class'], 'service'], ['==', ['get', 'class'], 'residential']],
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ''],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 8, 16, 10, 18, 12],
        'text-font': FONT_REGULAR,
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
        'text-anchor': 'center',
        'text-max-angle': 30,
        'text-allow-overlap': false,
        'text-padding': 2,
        'symbol-spacing': 250,
      },
      paint: {
        ...paint,
        'text-halo-width': 1.2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.4, 16, 0.8],
      },
    } as LayerProps,
  ];
}

/** White text with dark halo — for satellite and dark basemaps */
export const LABEL_LAYERS_LIGHT = makeLabelLayers(WHITE_ON_DARK);

/** Dark text with white halo — for light basemaps */
export const LABEL_LAYERS_DARK = makeLabelLayers(DARK_ON_LIGHT);
