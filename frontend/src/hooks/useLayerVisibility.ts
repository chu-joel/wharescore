import { useCallback, useRef } from 'react';
import { useMapStore } from '@/stores/mapStore';

/** Layer IDs grouped by accordion section */
export const SECTION_LAYERS: Record<string, string[]> = {
  risk: ['flood_zones', 'tsunami_zones', 'liquefaction_zones', 'coastal_erosion'],
  liveability: ['school_zones', 'osm_amenities', 'conservation_land'],
  // market has no map layers
  transport: ['transit_stops', 'crashes'],
  planning: ['district_plan_zones', 'heritage_sites', 'contaminated_land', 'infrastructure_projects', 'transmission_lines'],
};

export function useLayerVisibility() {
  const layers = useMapStore((s) => s.layers);
  const setLayers = useMapStore((s) => s.setLayers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  // Each section stores its own "prior state" snapshot
  const priorRef = useRef<Record<string, Record<string, boolean>>>({});

  const toggleSection = useCallback(
    (sectionId: string) => {
      const sectionLayers = SECTION_LAYERS[sectionId];
      if (!sectionLayers) return;

      const isCurrentlyOn = sectionLayers.every((id) => layers[id]);

      if (isCurrentlyOn) {
        // Toggle OFF: restore prior state for this section's layers only
        const prior = priorRef.current[sectionId] ?? {};
        const restored = { ...layers };
        for (const id of sectionLayers) {
          restored[id] = prior[id] ?? false;
        }
        setLayers(restored);
        delete priorRef.current[sectionId];
      } else {
        // Toggle ON: snapshot current state for this section, then enable all
        priorRef.current[sectionId] = {};
        for (const id of sectionLayers) {
          priorRef.current[sectionId][id] = layers[id] ?? false;
        }
        const updated = { ...layers };
        for (const id of sectionLayers) {
          updated[id] = true;
        }
        setLayers(updated);
      }
    },
    [layers, setLayers]
  );

  const isSectionActive = useCallback(
    (sectionId: string) => {
      const sectionLayers = SECTION_LAYERS[sectionId];
      if (!sectionLayers) return false;
      return sectionLayers.every((id) => layers[id]);
    },
    [layers]
  );

  return { layers, toggleLayer, toggleSection, isSectionActive };
}
