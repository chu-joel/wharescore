// lib/basemapStyles.ts — available basemap styles for the map style picker
//
// All raster styles use the SAME source name ("basemap") and layer ID ("basemap-tiles")
// so react-map-gl's style diffing can swap tile URLs without tearing down sources mid-request.

import { LINZ_KEY } from './constants';

export interface BasemapStyle {
  id: string;
  label: string;
  /** Hex fallback color while preview loads */
  color: string;
  /** Real tile image URL for the picker thumbnail (Wellington, z=10, x=1008, y=642) */
  previewUrl: string;
  /** MapLibre style — either a URL (vector) or a StyleSpecification (raster) */
  style: string | maplibregl.StyleSpecification;
}

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = '&copy; <a href="https://carto.com/">CARTO</a>, ' + OSM_ATTRIBUTION;

function rasterStyle(
  tiles: string[],
  attribution: string,
): maplibregl.StyleSpecification {
  return {
    version: 8,
    // Public glyph source — needed for symbol text labels on overlay layers
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles,
        tileSize: 256,
        maxzoom: 18,
        attribution,
      },
    },
    layers: [{ id: 'basemap-tiles', type: 'raster', source: 'basemap' }],
  };
}

// Wellington CBD tile at z=10, x=1008, y=642
const WLG = { z: 10, x: 1008, y: 642 };

export const BASEMAP_STYLES: BasemapStyle[] = [
  {
    id: 'standard',
    label: 'Standard',
    color: '#e8e0d8',
    previewUrl: `https://tile.openstreetmap.org/${WLG.z}/${WLG.x}/${WLG.y}.png`,
    style: rasterStyle(
      ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      OSM_ATTRIBUTION,
    ),
  },
  {
    id: 'light',
    label: 'Light',
    color: '#f5f3ef',
    previewUrl: `https://a.basemaps.cartocdn.com/light_all/${WLG.z}/${WLG.x}/${WLG.y}.png`,
    style: rasterStyle(
      [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      CARTO_ATTRIBUTION,
    ),
  },
  {
    id: 'dark',
    label: 'Dark',
    color: '#1a1a2e',
    previewUrl: `https://a.basemaps.cartocdn.com/dark_all/${WLG.z}/${WLG.x}/${WLG.y}.png`,
    style: rasterStyle(
      [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      CARTO_ATTRIBUTION,
    ),
  },
  {
    id: 'satellite',
    label: 'Hybrid (Satellite)',
    color: '#1a3a1a',
    // Hybrid: Satellite with street labels via Mapbox Streets style as fallback
    previewUrl: `https://a.basemaps.cartocdn.com/rastertiles/voyager/${WLG.z}/${WLG.x}/${WLG.y}.png`,
    style: rasterStyle(
      [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      CARTO_ATTRIBUTION,
    ),
  },
  // LINZ Topo — only available when API key is configured
  ...(LINZ_KEY
    ? [
        {
          id: 'topo',
          label: 'NZ Topo',
          color: '#c5d8b5',
          previewUrl: `https://basemaps.linz.govt.nz/v1/tiles/topolite-v2/WebMercatorQuad/${WLG.z}/${WLG.x}/${WLG.y}.png?api=${LINZ_KEY}`,
          style: `https://basemaps.linz.govt.nz/v1/styles/topolite-v2.json?api=${LINZ_KEY}`,
        } satisfies BasemapStyle,
      ]
    : []),
];

export const DEFAULT_BASEMAP_ID = 'satellite';

export function getBasemapStyle(id: string): BasemapStyle {
  return BASEMAP_STYLES.find((s) => s.id === id) ?? BASEMAP_STYLES[0];
}
