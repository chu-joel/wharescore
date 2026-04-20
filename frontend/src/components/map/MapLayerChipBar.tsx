'use client';

import { useCallback } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { MAX_ACTIVE_LAYERS } from '@/lib/constants';
import {
  Droplets,
  GraduationCap,
  Bus,
  Landmark,
  Building2,
} from 'lucide-react';
import { MapLayerPicker } from './MapLayerPicker';
import { toast } from 'sonner';

// Quick-toggle preset chips. the most commonly used layer groups.
// Each toggles a group on/off. Individual control is in the Layers picker.
const QUICK_PRESETS = [
  {
    id: 'hazards',
    label: 'Hazards',
    icon: Droplets,
    layers: ['flood_zones', 'liquefaction_zones', 'slope_failure_zones', 'tsunami_zones', 'coastal_erosion', 'wind_zones'],
  },
  {
    id: 'property',
    label: 'Property',
    icon: Building2,
    layers: ['parcels', 'building_outlines'],
  },
  {
    id: 'schools',
    label: 'Schools',
    icon: GraduationCap,
    layers: ['school_zones'],
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: Landmark,
    layers: ['district_plan_zones', 'contaminated_land', 'heritage_sites', 'infrastructure_projects'],
  },
  {
    id: 'transport',
    label: 'Transport',
    icon: Bus,
    layers: ['transit_stops', 'crashes'],
  },
] as const;

export function MapLayerChipBar() {
  const layers = useMapStore((s) => s.layers);
  const setLayers = useMapStore((s) => s.setLayers);

  const togglePreset = useCallback(
    (presetLayers: readonly string[]) => {
      const allActive = presetLayers.every((id) => layers[id]);
      const updated = { ...layers };
      if (allActive) {
        // Turn all off
        for (const id of presetLayers) updated[id] = false;
      } else {
        // Turn on up to the cap
        const currentActive = Object.values(updated).filter(Boolean).length;
        let added = 0;
        let skipped = 0;
        for (const id of presetLayers) {
          if (updated[id]) continue;
          if (currentActive + added < MAX_ACTIVE_LAYERS) {
            updated[id] = true;
            added++;
          } else {
            skipped++;
          }
        }
        if (skipped > 0) {
          toast.info(`Layer limit reached (${MAX_ACTIVE_LAYERS} max). Disable some layers first.`);
        }
      }
      setLayers(updated);
    },
    [layers, setLayers],
  );

  return (
    <div data-tour="map-layers" className="flex flex-wrap items-center gap-1.5 py-1">
      {/* Quick-toggle preset chips */}
      {QUICK_PRESETS.map((preset) => {
        const Icon = preset.icon;
        const allActive = preset.layers.every((id) => layers[id]);
        const someActive = !allActive && preset.layers.some((id) => layers[id]);

        return (
          <button
            key={preset.id}
            onClick={() => togglePreset(preset.layers)}
            aria-pressed={allActive}
            title={`Toggle ${preset.label} layers`}
            className={`shrink-0 flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-lg text-xs font-medium border transition-all active:scale-95 ${
              allActive
                ? 'bg-piq-primary text-white border-piq-primary shadow-sm'
                : someActive
                  ? 'bg-piq-primary/40 text-white border-piq-primary/60 shadow-sm'
                  : 'bg-background/95 backdrop-blur-sm text-muted-foreground border-border hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{preset.label}</span>
          </button>
        );
      })}

      {/* Layers button. opens the full layer picker dialog */}
      <MapLayerPicker />
    </div>
  );
}
