import { create } from 'zustand';
import { DEFAULT_CENTER } from '@/lib/constants';
import { DEFAULT_BASEMAP_ID } from '@/lib/basemapStyles';

interface MapState {
  viewport: { longitude: number; latitude: number; zoom: number };
  selectedPropertyId: number | null;
  layers: Record<string, boolean>;
  baseStyleId: string;
  setViewport: (v: MapState['viewport']) => void;
  selectProperty: (id: number, lng: number, lat: number) => void;
  toggleLayer: (id: string) => void;
  setLayers: (layers: Record<string, boolean>) => void;
  setBaseStyle: (id: string) => void;
  resetViewport: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewport: { ...DEFAULT_CENTER },
  selectedPropertyId: null,
  layers: { parcels: true },
  baseStyleId: DEFAULT_BASEMAP_ID,
  setViewport: (viewport) => set({ viewport }),
  selectProperty: (id, longitude, latitude) =>
    set({ selectedPropertyId: id, viewport: { longitude, latitude, zoom: 17 } }),
  toggleLayer: (id) =>
    set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  setLayers: (layers) => set({ layers }),
  setBaseStyle: (baseStyleId) => set({ baseStyleId }),
  resetViewport: () =>
    set({ viewport: { ...DEFAULT_CENTER }, selectedPropertyId: null }),
}));
