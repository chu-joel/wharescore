'use client';

import { useMapStore } from '@/stores/mapStore';
import { TILE_LAYERS, MAX_ACTIVE_LAYERS } from '@/lib/constants';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Droplets,
  Waves,
  Mountain,
  Wind,
  GraduationCap,
  Bus,
  AlertTriangle,
  Landmark,
  Building2,
  Zap,
  Construction,
  Skull,
  Volume2,
  TreePine,
  Coffee,
  Map as MapIcon,
  Layers,
  CircleDot,
  Fence,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Icon + description for each individual layer
const LAYER_META: Record<string, { icon: LucideIcon; description: string }> = {
  flood_zones:             { icon: Droplets,     description: 'River and coastal flood extents' },
  tsunami_zones:           { icon: Waves,        description: 'Tsunami evacuation zones' },
  liquefaction_zones:      { icon: Mountain,     description: 'Ground liquefaction risk zones' },
  slope_failure_zones:     { icon: TriangleAlert,description: 'Earthquake-induced landslide susceptibility' },
  coastal_erosion:         { icon: Waves,        description: 'Coastal erosion susceptibility' },
  wind_zones:              { icon: Wind,         description: 'Wind speed design zones' },
  school_zones:            { icon: GraduationCap,description: 'School enrolment zone boundaries' },
  transit_stops:           { icon: Bus,          description: 'Bus and train stops' },
  crashes:                 { icon: AlertTriangle,description: 'Reported road crashes' },
  district_plan_zones:     { icon: Landmark,     description: 'Council zoning (residential, commercial, etc.)' },
  heritage_sites:          { icon: Landmark,     description: 'Heritage New Zealand listed places' },
  contaminated_land:       { icon: Skull,        description: 'Known contaminated sites (SLUR)' },
  infrastructure_projects: { icon: Construction, description: 'Planned infrastructure projects' },
  transmission_lines:      { icon: Zap,          description: 'High-voltage power lines' },
  parcels:                 { icon: Fence,        description: 'Property parcel boundaries' },
  building_outlines:       { icon: Building2,    description: 'Building footprints' },
  noise_contours:          { icon: Volume2,      description: 'Road traffic noise levels' },
  conservation_land:       { icon: TreePine,     description: 'DOC reserves and national parks' },
  osm_amenities:           { icon: Coffee,       description: 'Cafes, shops, parks and more' },
  sa2_boundaries:          { icon: MapIcon,      description: 'Statistical area boundaries' },
  mv_nzdep_choropleth:     { icon: MapIcon,      description: 'NZ Deprivation Index by meshblock (1-10)' },
  mv_crime_choropleth:     { icon: AlertTriangle,description: 'Crime density heatmap (3-year victimisations)' },
  landslide_events:        { icon: Mountain,     description: 'GNS recorded landslide events' },
  landslide_areas:         { icon: Mountain,     description: 'GNS mapped landslide areas' },
  // Auckland / regional overlays
  overland_flow_paths:     { icon: Droplets,     description: 'Overland stormwater flow paths' },
  aircraft_noise_overlay:  { icon: Volume2,      description: 'Airport noise contours' },
  notable_trees:           { icon: TreePine,     description: 'Protected notable/scheduled trees' },
  significant_ecological_areas: { icon: TreePine, description: 'Significant ecological areas' },
  special_character_areas: { icon: Landmark,     description: 'Special character area overlays' },
  historic_heritage_overlay: { icon: Landmark,   description: 'Council heritage overlays (points)' },
  heritage_extent:         { icon: Landmark,     description: 'Heritage extent boundaries' },
  height_variation_control: { icon: Building2,   description: 'Height variation control zones' },
  mana_whenua_sites:       { icon: CircleDot,    description: 'Sites of significance to Mana Whenua' },
  park_extents:            { icon: TreePine,     description: 'Public park boundaries' },
  active_faults:           { icon: TriangleAlert, description: 'GNS active fault traces' },
};

// Groups for the picker
const GROUPS = [
  { label: 'Hazards', ids: ['flood_zones', 'liquefaction_zones', 'slope_failure_zones', 'tsunami_zones', 'coastal_erosion', 'wind_zones', 'landslide_events', 'landslide_areas', 'active_faults', 'overland_flow_paths'] },
  { label: 'Liveability', ids: ['mv_nzdep_choropleth', 'mv_crime_choropleth', 'park_extents'] },
  { label: 'Property', ids: ['parcels', 'building_outlines'] },
  { label: 'Schools & Community', ids: ['school_zones', 'notable_trees'] },
  { label: 'Planning & Environment', ids: ['district_plan_zones', 'contaminated_land', 'heritage_sites', 'historic_heritage_overlay', 'heritage_extent', 'special_character_areas', 'height_variation_control', 'significant_ecological_areas', 'mana_whenua_sites', 'infrastructure_projects', 'transmission_lines'] },
  { label: 'Transport', ids: ['transit_stops', 'crashes'] },
  { label: 'Context', ids: ['noise_contours', 'aircraft_noise_overlay', 'conservation_land', 'osm_amenities', 'sa2_boundaries'] },
];

export function MapLayerPicker() {
  const layers = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const setLayers = useMapStore((s) => s.setLayers);

  const activeCount = TILE_LAYERS.filter((l) => layers[l.id]).length;
  const atCap = activeCount >= MAX_ACTIVE_LAYERS;

  const handleToggleLayer = (id: string) => {
    const success = toggleLayer(id);
    if (!success) {
      toast.info(`Layer limit reached (${MAX_ACTIVE_LAYERS} max). Disable some layers first.`);
    }
  };

  const toggleGroup = (ids: string[]) => {
    const allActive = ids.every((id) => layers[id]);
    const updated = { ...layers };
    if (allActive) {
      for (const id of ids) updated[id] = false;
    } else {
      const currentActive = Object.values(updated).filter(Boolean).length;
      let added = 0;
      let skipped = 0;
      for (const id of ids) {
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
  };

  const clearAll = () => {
    const updated: Record<string, boolean> = {};
    for (const l of TILE_LAYERS) {
      updated[l.id] = false;
    }
    setLayers(updated);
  };

  return (
    <Dialog>
      <DialogTrigger
        data-layer-picker-trigger
        className="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border bg-background/95 backdrop-blur-sm text-muted-foreground border-border hover:bg-muted hover:text-foreground transition-all active:scale-95"
      >
        <Layers className="h-3.5 w-3.5" />
        <span>Layers</span>
        {activeCount > 0 && (
          <span className="flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded-full bg-piq-primary text-white text-[9px] font-bold leading-none">
            {activeCount}
          </span>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Map Layers</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">
            {activeCount}/{MAX_ACTIVE_LAYERS} layers active
          </p>
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-piq-primary hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="space-y-4">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </h3>
                <button
                  onClick={() => toggleGroup(group.ids)}
                  className="text-[11px] text-piq-primary hover:underline"
                >
                  {group.ids.every((id) => layers[id]) ? 'Hide all' : 'Show all'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {group.ids.map((id) => {
                  const meta = LAYER_META[id];
                  const tileConfig = TILE_LAYERS.find((l) => l.id === id);
                  if (!meta || !tileConfig) return null;
                  const Icon = meta.icon;
                  const active = !!layers[id];

                  const disabled = !active && atCap;

                  return (
                    <button
                      key={id}
                      onClick={() => handleToggleLayer(id)}
                      disabled={disabled}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-all ${
                        active
                          ? 'bg-piq-primary/8 ring-1 ring-piq-primary/20'
                          : disabled
                            ? 'opacity-40 cursor-not-allowed'
                            : 'hover:bg-muted'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                          active ? 'bg-piq-primary/15 text-piq-primary' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${active ? 'text-piq-primary' : ''}`}>
                          {tileConfig.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {meta.description}
                        </p>
                      </div>
                      {/* Toggle indicator */}
                      <div
                        className={`w-9 h-5 rounded-full shrink-0 relative transition-colors ${
                          active ? 'bg-piq-primary' : 'bg-muted-foreground/20'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                            active ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
