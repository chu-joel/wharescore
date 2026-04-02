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

/** Satellite imagery + vector place/road labels (no POI — our notable_places handles that) */
function satelliteWithLabels(
  imageryTiles: string[],
  imageryAttribution: string,
): string | maplibregl.StyleSpecification {
  const labelFont = ['Open Sans Regular', 'Arial Unicode MS Regular'];
  const labelFontBold = ['Open Sans Semibold', 'Arial Unicode MS Regular'];
  return {
    version: 8,
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles: imageryTiles,
        tileSize: 256,
        maxzoom: 18,
        attribution: imageryAttribution,
      },
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json',
        attribution: CARTO_ATTRIBUTION,
      },
    },
    layers: [
      { id: 'basemap-tiles', type: 'raster', source: 'basemap' },
      // Road names — white text, dark halo for satellite readability
      {
        id: 'road-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          'text-field': '{name}',
          'text-font': labelFont,
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 16, 12, 18, 14],
          'symbol-placement': 'line',
          'text-rotation-alignment': 'map',
          'text-pitch-alignment': 'viewport',
          'text-max-angle': 30,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': 'rgba(0,0,0,0.6)',
          'text-halo-width': 1.5,
        },
      },
      // Suburb / neighbourhood names
      {
        id: 'place-suburb',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'suburb', 'neighbourhood', 'quarter'],
        minzoom: 12,
        layout: {
          'text-field': '{name}',
          'text-font': labelFontBold,
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 15, 14],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
        },
        paint: {
          'text-color': 'rgba(255,255,255,0.9)',
          'text-halo-color': 'rgba(0,0,0,0.5)',
          'text-halo-width': 1.5,
        },
      },
      // Town / city names
      {
        id: 'place-city',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town', 'village'],
        minzoom: 6,
        layout: {
          'text-field': '{name}',
          'text-font': labelFontBold,
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 10, 14, 14, 16],
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': 'rgba(0,0,0,0.6)',
          'text-halo-width': 2,
        },
      },
      // Water names
      {
        id: 'water-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
        layout: {
          'text-field': '{name}',
          'text-font': labelFont,
          'text-size': 12,
        },
        paint: {
          'text-color': 'rgba(180,220,255,0.9)',
          'text-halo-color': 'rgba(0,0,0,0.4)',
          'text-halo-width': 1,
        },
      },
    ] as maplibregl.LayerSpecification[],
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
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    // Text size overrides applied in MapContainer after style loads
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
    style: satelliteWithLabels(
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
          style: satelliteWithLabels(
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

export const DEFAULT_BASEMAP_ID = 'satellite';

export function getBasemapStyle(id: string): BasemapStyle {
  return BASEMAP_STYLES.find((s) => s.id === id) ?? BASEMAP_STYLES[0];
}
