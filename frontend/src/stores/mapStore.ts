import { create } from 'zustand';
import { DEFAULT_CENTER, DEFAULT_LAYERS, PROPERTY_CONTEXT_LAYERS, MAX_ACTIVE_LAYERS, TILE_LAYERS } from '@/lib/constants';
import { DEFAULT_BASEMAP_ID } from '@/lib/basemapStyles';

function countActive(layers: Record<string, boolean>): number {
  return Object.values(layers).filter(Boolean).length;
}

function enforceCap(layers: Record<string, boolean>): Record<string, boolean> {
  const entries = Object.entries(layers);
  const enabled = entries.filter(([, v]) => v);
  if (enabled.length <= MAX_ACTIVE_LAYERS) return layers;
  const result: Record<string, boolean> = {};
  for (const [k] of entries) result[k] = false;
  for (let i = 0; i < MAX_ACTIVE_LAYERS; i++) {
    result[enabled[i][0]] = true;
  }
  return result;
}

interface MapState {
  viewport: { longitude: number; latitude: number; zoom: number };
  selectedPropertyId: number | null;
  layers: Record<string, boolean>;
  baseStyleId: string;
  userHasChangedLayers: boolean;
  setViewport: (v: MapState['viewport']) => void;
  selectProperty: (id: number, lng: number, lat: number) => void;
  toggleLayer: (id: string) => boolean;
  setLayers: (layers: Record<string, boolean>) => void;
  setBaseStyle: (id: string) => void;
  resetViewport: () => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  viewport: { ...DEFAULT_CENTER },
  selectedPropertyId: null,
  layers: { ...DEFAULT_LAYERS },
  baseStyleId: DEFAULT_BASEMAP_ID,
  userHasChangedLayers: false,
  setViewport: (viewport) => set({ viewport }),
  selectProperty: (id, longitude, latitude) => {
    const state = get();
    let layers = state.layers;
    if (!state.userHasChangedLayers) {
      // Auto-enable property context layers
      const merged = { ...layers };
      for (const [k, v] of Object.entries(PROPERTY_CONTEXT_LAYERS)) {
        if (v) merged[k] = true;
      }
      layers = enforceCap(merged);
    }
    set({ selectedPropertyId: id, viewport: { longitude, latitude, zoom: 17 }, layers });
  },
  toggleLayer: (id) => {
    const state = get();
    const current = !!state.layers[id];
    if (!current && countActive(state.layers) >= MAX_ACTIVE_LAYERS) {
      return false; // at cap
    }
    set({ layers: { ...state.layers, [id]: !current }, userHasChangedLayers: true });
    return true;
  },
  setLayers: (layers) => set({ layers: enforceCap(layers), userHasChangedLayers: true }),
  setBaseStyle: (baseStyleId) => set({ baseStyleId }),
  resetViewport: () =>
    set({ viewport: { ...DEFAULT_CENTER }, selectedPropertyId: null, layers: { ...DEFAULT_LAYERS }, userHasChangedLayers: false }),
}));
