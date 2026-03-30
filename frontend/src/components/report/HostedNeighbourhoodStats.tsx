'use client';

import { MapPin, AlertTriangle, Wind, Droplets, ShoppingCart } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';

interface NearestSupermarket {
  name: string;
  brand?: string | null;
  distance_m: number;
  latitude: number;
  longitude: number;
}

interface Props {
  rawReport: Record<string, unknown>;
  snapshot?: ReportSnapshot;
}

export function HostedNeighbourhoodStats({ rawReport, snapshot }: Props) {
  const live = (rawReport.liveability ?? {}) as unknown as Record<string, unknown>;
  const env = (rawReport.environment ?? {}) as unknown as Record<string, unknown>;
  const hazards = (rawReport.hazards ?? {}) as unknown as Record<string, unknown>;
  const planning = (rawReport.planning ?? {}) as unknown as Record<string, unknown>;

  // Nearest essentials — SQL returns these as JSON objects with {name, distance_m}
  const essentials: { label: string; value: string }[] = [];
  const addEssentialObj = (label: string, key: string) => {
    const obj = live[key] as { name?: string; distance_m?: number } | null;
    if (!obj) return;
    const name = obj.name;
    const dist = obj.distance_m;
    if (name || dist) essentials.push({ label, value: `${name || label} — ${dist ? Math.round(dist) + ' m' : 'nearby'}` });
  };
  addEssentialObj('GP / Medical', 'nearest_gp');
  addEssentialObj('Pharmacy', 'nearest_pharmacy');
  addEssentialObj('Supermarket', 'nearest_supermarket');
  const nearestPark = planning.nearest_park_name as string;
  const nearestParkDist = planning.nearest_park_distance_m as number;
  if (nearestPark || nearestParkDist) essentials.push({ label: 'Park', value: `${nearestPark || 'Park'} — ${nearestParkDist ? Math.round(nearestParkDist) + ' m' : 'nearby'}` });
  const conservation = live.conservation_nearest as string;
  const conservationDist = live.conservation_nearest_distance_m as number;
  if (conservation) essentials.push({ label: 'Reserve', value: `${conservation} — ${conservationDist ? Math.round(conservationDist) + 'm' : 'nearby'}` });

  // Notable trees
  const notableTreeCount = (planning.notable_trees_50m ?? planning.notable_tree_count_50m) as number;
  const notableTreeNearest = planning.notable_tree_nearest as { name: string; tree_type: string; distance_m: number } | null;

  // Park count
  const parkCount = planning.park_count_500m as number;

  // Contaminated land
  const contamCount = (env.contam_count_2km ?? hazards.contam_count_500m ?? hazards.contamination_count) as number;
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
  const climatePrecip = env.climate_precip_change_pct as number;
  const solarMean = hazards.solar_mean_kwh as number;

  // Walking reach (10-min walk via Valhalla) — preferred over 800m radius
  const walkingReach = (rawReport.walking_reach ?? null) as { minutes: number; method: string; total_stops: number; bus_stops: number; rail_stops: number; ferry_stops: number } | null;
  const hasWalkingReach = walkingReach && walkingReach.method !== 'none' && walkingReach.total_stops > 0;

  // Transit mode breakdown (fallback to 800m radius)
  const busStops = hasWalkingReach ? walkingReach.bus_stops : (live.bus_stops_800m as number);
  const railStops = hasWalkingReach ? walkingReach.rail_stops : (live.rail_stops_800m as number);
  const ferryStops = hasWalkingReach ? walkingReach.ferry_stops : (live.ferry_stops_800m as number);
  const cableCarStops = hasWalkingReach ? 0 : (live.cable_car_stops_800m as number);
  const transitModes: { mode: string; count: number }[] = [];
  if (busStops) transitModes.push({ mode: 'Bus', count: busStops });
  if (railStops) transitModes.push({ mode: 'Rail', count: railStops });
  if (ferryStops) transitModes.push({ mode: 'Ferry', count: ferryStops });
  if (cableCarStops) transitModes.push({ mode: 'Cable Car', count: cableCarStops });

  // Transit peak frequency
  const peakTrips = live.peak_trips_per_hour as number;
  const nearestStopName = live.nearest_stop_name as string;

  // Transmission line
  const transmissionDist = planning.transmission_line_distance_m as number;

  // Council rates
  const ratesData = (snapshot as unknown as Record<string, unknown>)?.rates_data as { total_rates?: number; rates_breakdown?: Array<{ name: string; amount: number }> } | null;

  // Transit travel times (AM + PM peak)
  type TravelTime = { destination: string; minutes: number; routes?: string[]; travel_time_min?: number; route?: string };
  const travelTimes = (live.transit_travel_times ?? []) as TravelTime[];
  const travelTimesPm = (live.transit_travel_times_pm ?? []) as TravelTime[];

  // Comparison benchmarks
  const comparisons = (rawReport.comparisons ?? {}) as Record<string, unknown>;
  const suburbAvg = comparisons.suburb as { label?: string; avg_nzdep?: number; school_count_1500m?: number; transit_count_400m?: number; max_noise_db?: number; epb_count_300m?: number } | null;
  const cityAvg = comparisons.city as { label?: string; avg_nzdep?: number; avg_school_count_1500m?: number; avg_transit_count_400m?: number; avg_noise_db?: number; avg_epb_count_300m?: number } | null;

  // Corrosion zone
  const inCorrosionZone = env.in_corrosion_zone as boolean;

  // Community facilities (from snapshot)
  const cf = (snapshot as unknown as Record<string, unknown>)?.community_facilities as {
    nearest_hospital?: { name: string; distance_m: number } | null;
    nearest_ev_charger?: { name: string; distance_m: number } | null;
    ev_chargers_5km?: number;
    libraries_2km?: number;
    sports_facilities_2km?: number;
    playgrounds_2km?: number;
    community_centres_2km?: number;
    cycling_facilities_2km?: number;
    fibre_available?: boolean;
    fibre_provider?: string;
    cycleway_km_2km?: number;
  } | null;

  // Heritage
  const heritageCount = live.heritage_count_500m as number;
  const heritageListed = planning.heritage_listed as boolean;

  // Heritage overlay details
  const heritageOverlayName = planning.heritage_overlay_name as string;
  const heritageOverlayType = planning.heritage_overlay_type as string;

  // Geotechnical reports
  const geotechCount = hazards.geotech_count_500m as number;
  const geotechHazard = hazards.geotech_nearest_hazard as string;

  // Planning overlays
  const overlays: string[] = [];
  if (planning.in_viewshaft) overlays.push(`Viewshaft${planning.viewshaft_name ? `: ${planning.viewshaft_name}` : ''}`);
  if (planning.in_ecological_area) overlays.push(`Ecological area${planning.ecological_area_name ? `: ${planning.ecological_area_name}` : ''}`);
  if (planning.in_character_precinct) overlays.push(`Character precinct${planning.character_precinct_name ? `: ${planning.character_precinct_name}` : ''}`);
  if (planning.in_special_character ?? planning.in_special_character_area) overlays.push(`Special character area${planning.special_character_name ? `: ${planning.special_character_name}` : ''}`);
  if (planning.in_mana_whenua) overlays.push(`Mana whenua${planning.mana_whenua_name ? `: ${planning.mana_whenua_name}` : ''}`);
  if (planning.in_heritage_overlay) overlays.push(`Heritage overlay${heritageOverlayName ? `: ${heritageOverlayName}` : ''}${heritageOverlayType ? ` (${heritageOverlayType})` : ''}`);

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

  const hasContent = essentials.length > 0 || contamCount || climateTemp || solarMean || crashTotal || airSite || waterSite || amenityItems.length > 0 || transitModes.length > 0 || travelTimes.length > 0 || suburbAvg || cityAvg || peakTrips || ratesData?.total_rates || transmissionDist;
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

        {/* Community facilities */}
        {cf && (cf.nearest_hospital || cf.libraries_2km || cf.ev_chargers_5km) && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Community Facilities</h4>
            <div className="divide-y divide-border/50">
              {cf.nearest_hospital && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="font-medium">Hospital</span>
                  <span className="text-muted-foreground text-xs">{cf.nearest_hospital.name} — {Math.round(cf.nearest_hospital.distance_m / 1000)}km</span>
                </div>
              )}
              {cf.nearest_ev_charger && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="font-medium">EV Charger</span>
                  <span className="text-muted-foreground text-xs">{cf.nearest_ev_charger.name || 'Charger'} — {cf.nearest_ev_charger.distance_m < 1000 ? `${Math.round(cf.nearest_ev_charger.distance_m)}m` : `${(cf.nearest_ev_charger.distance_m / 1000).toFixed(1)}km`}{cf.ev_chargers_5km ? ` (${cf.ev_chargers_5km} within 5km)` : ''}</span>
                </div>
              )}
              {(cf.libraries_2km ?? 0) > 0 && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="font-medium">Libraries</span>
                  <span className="text-muted-foreground text-xs">{cf.libraries_2km} within 2km</span>
                </div>
              )}
              {(cf.sports_facilities_2km ?? 0) > 0 && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="font-medium">Sports / Pools</span>
                  <span className="text-muted-foreground text-xs">{cf.sports_facilities_2km} within 2km</span>
                </div>
              )}
              {(cf.playgrounds_2km ?? 0) > 0 && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="font-medium">Playgrounds</span>
                  <span className="text-muted-foreground text-xs">{cf.playgrounds_2km} within 2km</span>
                </div>
              )}
              {(cf.community_centres_2km ?? 0) > 0 && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="font-medium">Community Centres</span>
                  <span className="text-muted-foreground text-xs">{cf.community_centres_2km} within 2km</span>
                </div>
              )}
              {(cf.cycling_facilities_2km ?? 0) > 0 && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="font-medium">Cycling (parking/rental/repair)</span>
                  <span className="text-muted-foreground text-xs">{cf.cycling_facilities_2km} within 2km</span>
                </div>
              )}
              {cf.cycleway_km_2km != null && cf.cycleway_km_2km > 0 && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="font-medium">Cycle paths</span>
                  <span className="text-muted-foreground text-xs">{cf.cycleway_km_2km}km within 2km</span>
                </div>
              )}
              {cf.fibre_available != null && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="font-medium">Fibre broadband</span>
                  <span className={`text-xs font-medium ${cf.fibre_available ? 'text-green-600' : 'text-amber-600'}`}>
                    {cf.fibre_available ? `Available (${cf.fibre_provider || 'provider'})` : 'Not in fibre area'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nearest supermarkets (5 closest, brand-priority) */}
        {(() => {
          const supermarkets = ((snapshot as unknown as Record<string, unknown>)?.nearest_supermarkets ?? []) as NearestSupermarket[];
          if (supermarkets.length === 0) return null;
          return (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Nearest Supermarkets</h4>
              </div>
              <div className="divide-y divide-border/50">
                {supermarkets.map((s, i) => (
                  <div key={i} className="flex justify-between py-1.5 text-xs">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground">
                      {s.distance_m >= 1000
                        ? `${(s.distance_m / 1000).toFixed(1)} km`
                        : `${Math.round(s.distance_m)} m`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Transit mode breakdown */}
        {transitModes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-semibold">
                {hasWalkingReach ? 'Transit Stops (10-min walk)' : 'Transit Stops (800m)'}
              </h4>
              {hasWalkingReach && walkingReach.method === 'valhalla' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-piq-primary/10 text-piq-primary">
                  Hill-adjusted
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {transitModes.map((t) => (
                <span key={t.mode} className="px-2.5 py-1 rounded-lg bg-piq-primary/10 text-piq-primary text-xs font-medium">
                  {t.mode}: {t.count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Transit peak frequency */}
        {peakTrips != null && peakTrips > 0 && (
          <div className="rounded-lg bg-piq-primary/5 border border-piq-primary/20 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">~{Math.round(peakTrips)} services/hr at peak</p>
                {nearestStopName && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Nearest stop: {nearestStopName}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  peakTrips >= 20 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : peakTrips >= 8 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {peakTrips >= 20 ? 'Excellent' : peakTrips >= 8 ? 'Good' : 'Limited'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Transit travel times — AM peak */}
        {travelTimes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">
              Morning Peak {travelTimesPm.length > 0 ? '(7–9 AM)' : 'Travel Times'}
            </h4>
            <div className="divide-y divide-border/50">
              {travelTimes.slice(0, 8).map((t) => (
                <div key={t.destination} className="flex justify-between py-1.5 text-xs">
                  <span className="font-medium">{t.destination}</span>
                  <span className="text-muted-foreground">
                    {Math.round(t.minutes ?? t.travel_time_min ?? 0)} min{t.routes?.length ? ` · ${t.routes[0]}` : t.route ? ` · ${t.route}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transit travel times — PM peak */}
        {travelTimesPm.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Evening Peak (4:30–6:30 PM)</h4>
            <div className="divide-y divide-border/50">
              {travelTimesPm.slice(0, 8).map((t) => (
                <div key={t.destination} className="flex justify-between py-1.5 text-xs">
                  <span className="font-medium">{t.destination}</span>
                  <span className="text-muted-foreground">
                    {Math.round(t.minutes ?? t.travel_time_min ?? 0)} min{t.routes?.length ? ` · ${t.routes[0]}` : t.route ? ` · ${t.route}` : ''}
                  </span>
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
                  {contamName ? `${contamName} — ${Math.round(contamDist || 0)} m away` : `${contamCount} site${contamCount !== 1 ? 's' : ''} within 2 km`}.
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

        {/* Notable trees & parks */}
        {((notableTreeCount && notableTreeCount > 0) || (parkCount && parkCount > 0)) && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Green Space & Trees</h4>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {notableTreeCount > 0 && (
                <p>{notableTreeCount} notable/protected tree{notableTreeCount > 1 ? 's' : ''} within 50m.
                  {notableTreeNearest?.name && ` Nearest: ${notableTreeNearest.name}${notableTreeNearest.tree_type ? ` (${notableTreeNearest.tree_type})` : ''}.`}
                  {' '}Protected trees cannot be removed — check before planning building work.
                </p>
              )}
              {parkCount > 0 && <p>{parkCount} park{parkCount > 1 ? 's' : ''} within 500m.</p>}
            </div>
          </div>
        )}

        {/* Geotechnical reports */}
        {geotechCount != null && geotechCount > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Geotechnical Reports</h4>
            <p className="text-xs text-muted-foreground">
              {geotechCount} geotech report{geotechCount > 1 ? 's' : ''} filed within 500m.
              {geotechHazard && ` Nearest report hazard: ${geotechHazard}.`}
              {' '}Existing reports can indicate known ground conditions and save on investigation costs.
            </p>
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
        {(climateTemp || climatePrecip || solarMean) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {climateTemp && (
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Warming 2050</p>
                <p className="text-sm font-bold mt-1">+{(typeof climateTemp === 'number' ? climateTemp.toFixed(1) : climateTemp)}°C</p>
                <p className="text-[10px] text-muted-foreground">projected</p>
              </div>
            )}
            {climatePrecip != null && (
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Rainfall 2050</p>
                <p className="text-sm font-bold mt-1">{climatePrecip > 0 ? '+' : ''}{(typeof climatePrecip === 'number' ? climatePrecip.toFixed(0) : climatePrecip)}%</p>
                <p className="text-[10px] text-muted-foreground">change</p>
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

        {/* Annual council rates */}
        {ratesData?.total_rates != null && ratesData.total_rates > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-sm font-semibold mb-2">Annual Council Rates</h4>
            <p className="text-2xl font-bold text-piq-primary">
              ${ratesData.total_rates.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-muted-foreground ml-1">/year</span>
            </p>
            {ratesData.rates_breakdown && ratesData.rates_breakdown.length > 0 && (
              <div className="mt-2 divide-y divide-border/50">
                {ratesData.rates_breakdown.slice(0, 6).map((item, i) => (
                  <div key={i} className="flex justify-between py-1 text-xs">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium">${item.amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-2">
              Source: Council rates API. Amounts may differ from your actual rates notice.
            </p>
          </div>
        )}

        {/* Transmission line proximity */}
        {transmissionDist != null && transmissionDist > 0 && transmissionDist <= 500 && (
          <div className={`rounded-lg border p-3 ${
            transmissionDist <= 100
              ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10'
              : transmissionDist <= 200
                ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10'
                : 'border-border'
          }`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                transmissionDist <= 100 ? 'text-red-600' : transmissionDist <= 200 ? 'text-amber-600' : 'text-muted-foreground'
              }`} />
              <div>
                <p className="text-sm font-semibold">
                  High-voltage transmission line — {Math.round(transmissionDist)} m away
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {transmissionDist <= 100
                    ? 'Very close proximity. May affect property value, building restrictions, and insurance. Check Transpower corridor requirements.'
                    : transmissionDist <= 200
                      ? 'Nearby transmission infrastructure. Consider potential EMF exposure and building height restrictions.'
                      : 'Transmission line within 500m. Generally low impact at this distance.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comparison benchmarks */}
        {(suburbAvg || cityAvg) && (
          <div>
            <h4 className="text-sm font-semibold mb-2">How This Property Compares</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 pr-2 font-semibold text-piq-primary">Metric</th>
                    {suburbAvg?.label && <th className="text-center py-1.5 px-2 font-semibold text-piq-primary">{suburbAvg.label}</th>}
                    {cityAvg?.label && <th className="text-center py-1.5 px-2 font-semibold text-piq-primary">{cityAvg.label}</th>}
                  </tr>
                </thead>
                <tbody>
                  {suburbAvg?.avg_nzdep != null && (
                    <tr className="border-b border-border/50">
                      <td className="py-1.5 pr-2 text-muted-foreground">Avg Deprivation</td>
                      {suburbAvg && <td className="py-1.5 px-2 text-center font-medium">{suburbAvg.avg_nzdep?.toFixed(1)}</td>}
                      {cityAvg && <td className="py-1.5 px-2 text-center font-medium">{cityAvg.avg_nzdep?.toFixed(1) ?? '—'}</td>}
                    </tr>
                  )}
                  {(suburbAvg?.school_count_1500m != null || cityAvg?.avg_school_count_1500m != null) && (
                    <tr className="border-b border-border/50">
                      <td className="py-1.5 pr-2 text-muted-foreground">Schools (1.5km)</td>
                      {suburbAvg && <td className="py-1.5 px-2 text-center font-medium">{suburbAvg.school_count_1500m ?? '—'}</td>}
                      {cityAvg && <td className="py-1.5 px-2 text-center font-medium">{cityAvg.avg_school_count_1500m?.toFixed(0) ?? '—'}</td>}
                    </tr>
                  )}
                  {(suburbAvg?.transit_count_400m != null || cityAvg?.avg_transit_count_400m != null) && (
                    <tr className="border-b border-border/50">
                      <td className="py-1.5 pr-2 text-muted-foreground">Transit (400m)</td>
                      {suburbAvg && <td className="py-1.5 px-2 text-center font-medium">{suburbAvg.transit_count_400m ?? '—'}</td>}
                      {cityAvg && <td className="py-1.5 px-2 text-center font-medium">{cityAvg.avg_transit_count_400m?.toFixed(0) ?? '—'}</td>}
                    </tr>
                  )}
                  {(suburbAvg?.max_noise_db != null || cityAvg?.avg_noise_db != null) && (
                    <tr className="border-b border-border/50">
                      <td className="py-1.5 pr-2 text-muted-foreground">Road Noise (dB)</td>
                      {suburbAvg && <td className="py-1.5 px-2 text-center font-medium">{suburbAvg.max_noise_db?.toFixed(0) ?? '—'}</td>}
                      {cityAvg && <td className="py-1.5 px-2 text-center font-medium">{cityAvg.avg_noise_db?.toFixed(0) ?? '—'}</td>}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
