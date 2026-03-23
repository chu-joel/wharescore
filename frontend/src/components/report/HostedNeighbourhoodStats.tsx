'use client';

import { MapPin, AlertTriangle, Wind, Droplets } from 'lucide-react';

interface Props {
  rawReport: Record<string, unknown>;
}

export function HostedNeighbourhoodStats({ rawReport }: Props) {
  const live = (rawReport.liveability ?? {}) as unknown as Record<string, unknown>;
  const env = (rawReport.environment ?? {}) as unknown as Record<string, unknown>;
  const hazards = (rawReport.hazards ?? {}) as unknown as Record<string, unknown>;
  const planning = (rawReport.planning ?? {}) as unknown as Record<string, unknown>;

  // Nearest essentials
  const essentials: { label: string; value: string }[] = [];
  const addEssential = (label: string, nameKey: string, distKey: string) => {
    const name = live[nameKey] as string;
    const dist = live[distKey] as number;
    if (name || dist) essentials.push({ label, value: `${name || label} — ${dist ? Math.round(dist) + 'm' : 'nearby'}` });
  };
  addEssential('GP / Medical', 'nearest_gp_name', 'nearest_gp_m');
  addEssential('Pharmacy', 'nearest_pharmacy_name', 'nearest_pharmacy_m');
  addEssential('Supermarket', 'nearest_supermarket_name', 'nearest_supermarket_m');
  const nearestPark = live.nearest_park_name as string;
  const nearestParkDist = live.nearest_park_distance_m as number;
  if (nearestPark || nearestParkDist) essentials.push({ label: 'Park', value: `${nearestPark || 'Park'} — ${nearestParkDist ? Math.round(nearestParkDist) + 'm' : 'nearby'}` });
  const conservation = live.conservation_nearest as string;
  const conservationDist = live.conservation_nearest_distance_m as number;
  if (conservation) essentials.push({ label: 'Reserve', value: `${conservation} — ${conservationDist ? Math.round(conservationDist) + 'm' : 'nearby'}` });

  // Contaminated land
  const contamCount = (env.contam_count_2km ?? hazards.contamination_count) as number;
  const contamName = env.contam_nearest_name as string;
  const contamDist = env.contam_nearest_distance_m as number;
  const contamCat = env.contam_nearest_category as string;

  // Road safety
  const crashTotal = live.crashes_300m_total as number;
  const crashFatal = live.crashes_300m_fatal as number;
  const crashSerious = live.crashes_300m_serious as number;

  // Air quality
  const airSite = env.air_site_name as string;
  const airPm10 = env.air_pm10_trend as string;
  const airPm25 = env.air_pm25_trend as string;

  // Water quality
  const waterSite = env.water_site_name as string;
  const waterDrp = env.water_drp_band as string;
  const waterAmmonia = env.water_ammonia_band as string;

  // Climate + Solar
  const climateTemp = env.climate_temp_change as number;
  const solarMean = hazards.solar_mean_kwh as number;

  // Corrosion zone
  const inCorrosionZone = env.in_corrosion_zone as boolean;

  // Heritage
  const heritageCount = live.heritage_count_500m as number;
  const heritageListed = planning.heritage_listed as boolean;

  // Planning overlays
  const overlays: string[] = [];
  if (planning.in_viewshaft) overlays.push('Viewshaft');
  if (planning.in_ecological_area) overlays.push('Ecological area');
  if (planning.in_character_precinct) overlays.push('Character precinct');
  if (planning.in_special_character_area) overlays.push('Special character area');

  // Amenities chart
  const amenities500m = (live.amenities_500m ?? {}) as Record<string, number>;
  const EXCLUDED_AMENITIES = new Set(['bench', 'waste_basket', 'loading_dock', 'bicycle_parking', 'parking',
    'toilets', 'telephone', 'post_box', 'recycling', 'shelter', 'drinking_water', 'vending_machine', 'clock', 'fountain']);
  const amenityItems = Object.entries(amenities500m)
    .filter(([k, v]) => v > 0 && !EXCLUDED_AMENITIES.has(k))
    .map(([k, v]) => ({ name: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxAmenity = amenityItems[0]?.count ?? 1;

  const hasContent = essentials.length > 0 || contamCount || climateTemp || solarMean || crashTotal || airSite || waterSite || amenityItems.length > 0;
  if (!hasContent) return null;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">Neighbourhood Snapshot</h3>
      </div>
      <div className="px-5 pb-5 space-y-4">
        {/* Nearest essentials */}
        {essentials.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Nearest Essentials</h4>
            <div className="divide-y divide-border/50">
              {essentials.map((e) => (
                <div key={e.label} className="flex justify-between py-2 text-sm">
                  <span className="font-medium">{e.label}</span>
                  <span className="text-muted-foreground text-xs">{e.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Road safety */}
        {crashTotal != null && crashTotal > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Road Safety (300m, 5yr)</h4>
            <p className="text-xs text-muted-foreground">
              {crashTotal} crashes recorded nearby
              {crashFatal ? ` including ${crashFatal} fatal` : ''}
              {crashSerious ? ` and ${crashSerious} serious` : ''}.
              {crashTotal > 50 ? ' This is a road safety hotspot.' : ''}
            </p>
          </div>
        )}

        {/* Air quality */}
        {airSite && (airPm10 || airPm25) && (
          <div className="flex items-start gap-2">
            <Wind className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Air Quality</h4>
              <p className="text-xs text-muted-foreground">
                Monitoring: {airSite}.
                {airPm10 && ` PM10 trend: ${airPm10.toLowerCase()}.`}
                {airPm25 && ` PM2.5 trend: ${airPm25.toLowerCase()}.`}
              </p>
            </div>
          </div>
        )}

        {/* Water quality */}
        {waterSite && (waterDrp || waterAmmonia) && (
          <div className="flex items-start gap-2">
            <Droplets className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Water Quality</h4>
              <p className="text-xs text-muted-foreground">
                Nearest: {waterSite}.
                {waterDrp && ` Nutrient level: Grade ${waterDrp}.`}
                {waterAmmonia && ` Ammonia: Grade ${waterAmmonia}.`}
              </p>
            </div>
          </div>
        )}

        {/* Contaminated land */}
        {contamCount != null && contamCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Contaminated Land</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {contamName ? `${contamName} — ${Math.round(contamDist || 0)}m away` : `${contamCount} site${contamCount !== 1 ? 's' : ''} within 2km`}.
                  {contamCat && ` Category: ${contamCat}.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Heritage + overlays */}
        {(heritageListed || (heritageCount && heritageCount > 0) || overlays.length > 0) && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Heritage & Overlays</h4>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {heritageListed && <p className="font-medium text-amber-700">This property is heritage-listed.</p>}
              {heritageCount > 0 && <p>{heritageCount} heritage items within 500m.</p>}
              {overlays.length > 0 && <p>Planning overlays: {overlays.join(', ')}.</p>}
            </div>
          </div>
        )}

        {/* Corrosion zone */}
        {inCorrosionZone && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Corrosion zone:</span> This area has higher corrosion risk — affects exterior paint and metalwork choices.
          </p>
        )}

        {/* Amenities within 500m */}
        {amenityItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Amenities within 500m</h4>
            <div className="space-y-1.5">
              {amenityItems.map((a) => (
                <div key={a.name} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 text-right shrink-0">{a.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div className="h-full rounded-full bg-piq-primary" style={{ width: `${(a.count / maxAmenity) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-piq-primary w-8 text-right tabular-nums">{a.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Climate + Solar */}
        {(climateTemp || solarMean) && (
          <div className="grid grid-cols-2 gap-3">
            {climateTemp && (
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Climate 2050</p>
                <p className="text-sm font-bold mt-1">+{(typeof climateTemp === 'number' ? climateTemp.toFixed(1) : climateTemp)}°C</p>
                <p className="text-[10px] text-muted-foreground">projected warming</p>
              </div>
            )}
            {solarMean && (
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Solar Potential</p>
                <p className="text-sm font-bold mt-1">{Math.round(solarMean)} kWh/yr</p>
                <p className="text-[10px] text-muted-foreground">avg radiation</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
