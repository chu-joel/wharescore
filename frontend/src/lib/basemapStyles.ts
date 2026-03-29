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
const LINZ_ATTRIBUTION = '&copy; <a href="https://www.linz.govt.nz/">LINZ</a> CC-BY 4.0';
const ESRI_ATTRIBUTION = '&copy; Esri, Maxar, Earthstar Geographics';

function rasterStyle(
  tiles: string[],
  attribution: string,
): maplibregl.StyleSpecification {
  return {
    version: 8,
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
    id: 'standard',
    label: 'Standard',
    color: '#e8e0d8',
    previewUrl: `https://tile.openstreetmap.org/${WLG.z}/${WLG.x}/${WLG.y}.png`,
    style: rasterStyle(
      ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      OSM_ATTRIBUTION,
    ),
  },
  // Esri World Imagery + CARTO labels — hybrid satellite mode
  {
    id: 'satellite',
    label: 'Satellite',
    color: '#1a3a1a',
    previewUrl: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${WLG.z}/${WLG.y}/${WLG.x}`,
    style: rasterStyle(
      ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      ESRI_ATTRIBUTION,
    ),
  },
  // LINZ styles — only available when API key is configured
  ...(LINZ_KEY
    ? [
        {
          id: 'satellite-hd',
          label: 'Satellite HD',
          color: '#1a3a1a',
          previewUrl: `https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/${WLG.z}/${WLG.x}/${WLG.y}.webp?api=${LINZ_KEY}`,
          style: rasterStyle(
            [`https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/{z}/{x}/{y}.webp?api=${LINZ_KEY}`],
            LINZ_ATTRIBUTION,
          ),
        } satisfies BasemapStyle,
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

export const SATELLITE_STYLE_IDS = new Set(['satellite', 'satellite-hd']);

export const DEFAULT_BASEMAP_ID = 'light';

export function getBasemapStyle(id: string): BasemapStyle {
  return BASEMAP_STYLES.find((s) => s.id === id) ?? BASEMAP_STYLES[0];
}
