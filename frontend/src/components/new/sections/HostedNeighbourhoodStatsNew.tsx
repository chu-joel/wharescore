'use client';

import { useState } from 'react';
import { MapPin, AlertTriangle, Wind, Droplets, ShoppingCart, ChevronDown } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

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

function CollapsibleGroup({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0', fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)',
          background: 'transparent', border: 0, cursor: 'pointer', minHeight: 40,
        }}
      >
        {title}
        <ChevronDown size={16} style={{
          color: 'var(--ws-ink-mute)',
          transform: open ? 'rotate(180deg)' : undefined,
          transition: 'transform 200ms',
        }} />
      </button>
      {open && <div style={{ display: 'grid', gap: 16, paddingBottom: 8 }}>{children}</div>}
    </div>
  );
}

const subHeading: React.CSSProperties = {
  margin: '0 0 6px', fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)',
};

const keyValueRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', padding: '8px 0',
  fontSize: 13, borderTop: '1px solid var(--ws-rule)',
};

const keyValueRowFirst: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', padding: '8px 0',
  fontSize: 13,
};

const ratePillStyle = (band: 'good' | 'mod' | 'poor'): React.CSSProperties => {
  const map = {
    good: { bg: 'rgba(35,134,54,.10)', fg: 'var(--ws-success)' },
    mod:  { bg: 'rgba(213,94,0,.10)',  fg: 'var(--ws-r-high)' },
    poor: { bg: 'rgba(196,45,45,.10)', fg: 'var(--ws-r-vhigh)' },
  } as const;
  const c = map[band];
  return {
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
    background: c.bg, color: c.fg,
  };
};

const routeChip: React.CSSProperties = {
  marginLeft: 6, padding: '1px 6px', borderRadius: 4,
  background: 'rgba(13,115,119,.10)', color: 'var(--ws-piq-dark)',
  fontSize: 10.5, fontWeight: 600,
};

export function HostedNeighbourhoodStatsNew({ rawReport, snapshot }: Props) {
  const live = (rawReport.liveability ?? {}) as unknown as Record<string, unknown>;
  const env = (rawReport.environment ?? {}) as unknown as Record<string, unknown>;
  const hazards = (rawReport.hazards ?? {}) as unknown as Record<string, unknown>;
  const planning = (rawReport.planning ?? {}) as unknown as Record<string, unknown>;

  const essentials: { label: string; value: string }[] = [];
  const addEssentialObj = (label: string, key: string) => {
    const obj = live[key] as { name?: string; distance_m?: number } | null;
    if (!obj) return;
    const name = obj.name;
    const dist = obj.distance_m;
    if (name || dist) essentials.push({ label, value: `${name || label}. ${dist ? Math.round(dist) + ' m' : 'nearby'}` });
  };
  addEssentialObj('GP / Medical', 'nearest_gp');
  addEssentialObj('Pharmacy', 'nearest_pharmacy');
  addEssentialObj('Supermarket', 'nearest_supermarket');
  const nearestPark = planning.nearest_park_name as string;
  const nearestParkDist = planning.nearest_park_distance_m as number;
  if (nearestPark || nearestParkDist) essentials.push({ label: 'Park', value: `${nearestPark || 'Park'}. ${nearestParkDist ? Math.round(nearestParkDist) + ' m' : 'nearby'}` });
  const conservation = live.conservation_nearest as string;
  const conservationDist = live.conservation_nearest_distance_m as number;
  if (conservation) essentials.push({ label: 'Reserve', value: `${conservation}. ${conservationDist ? Math.round(conservationDist) + 'm' : 'nearby'}` });

  const notableTreeCount = (planning.notable_trees_50m ?? planning.notable_tree_count_50m) as number;
  const notableTreeNearest = planning.notable_tree_nearest as { name: string; tree_type: string; distance_m: number } | null;
  const parkCount = planning.park_count_500m as number;

  const contamCount = (env.contam_count_2km ?? hazards.contam_count_500m ?? hazards.contamination_count) as number;
  const contamName = env.contam_nearest_name as string;
  const contamDist = env.contam_nearest_distance_m as number;
  const contamCat = env.contam_nearest_category as string;

  const crashTotal = live.crashes_300m_total as number;
  const crashFatal = live.crashes_300m_fatal as number;
  const crashSerious = live.crashes_300m_serious as number;

  const airSite = env.air_site_name as string;
  const airPm10 = env.air_pm10_trend as string;
  const airPm25 = env.air_pm25_trend as string;
  const airDistM = (env.air_pm10_distance_m ?? env.air_pm25_distance_m ?? env.air_distance_m) as number | undefined;
  const airDistKm = airDistM ? (airDistM / 1000).toFixed(1) : null;

  const waterSite = env.water_site_name as string;
  const waterDrp = env.water_drp_band as string;
  const waterAmmonia = env.water_ammonia_band as string;
  const waterDistM = env.water_distance_m as number | undefined;
  const waterDistKm = waterDistM ? (waterDistM / 1000).toFixed(1) : null;

  const climateTemp = env.climate_temp_change as number;
  const climatePrecip = env.climate_precip_change_pct as number;
  const solarMean = hazards.solar_mean_kwh as number;

  const walkingReach = (rawReport.walking_reach ?? null) as { minutes: number; method: string; total_stops: number; bus_stops: number; rail_stops: number; ferry_stops: number } | null;
  const hasWalkingReach = walkingReach && walkingReach.method !== 'none' && walkingReach.total_stops > 0;

  const busStops = hasWalkingReach ? walkingReach.bus_stops : (live.bus_stops_800m as number);
  const railStops = hasWalkingReach ? walkingReach.rail_stops : (live.rail_stops_800m as number);
  const ferryStops = hasWalkingReach ? walkingReach.ferry_stops : (live.ferry_stops_800m as number);
  const cableCarStops = hasWalkingReach ? 0 : (live.cable_car_stops_800m as number);
  const transitModes: { mode: string; count: number }[] = [];
  if (busStops) transitModes.push({ mode: 'Bus', count: busStops });
  if (railStops) transitModes.push({ mode: 'Rail', count: railStops });
  if (ferryStops) transitModes.push({ mode: 'Ferry', count: ferryStops });
  if (cableCarStops) transitModes.push({ mode: 'Cable Car', count: cableCarStops });

  const peakTrips = live.peak_trips_per_hour as number;
  const nearestStopName = live.nearest_stop_name as string;

  const transmissionDist = planning.transmission_line_distance_m as number;

  const ratesData = (snapshot as unknown as Record<string, unknown>)?.rates_data as { total_rates?: number; rates_breakdown?: Array<{ name: string; amount: number }> } | null;

  type TravelTime = { destination: string; minutes: number; routes?: string[]; travel_time_min?: number; route?: string };
  const travelTimes = (live.transit_travel_times ?? []) as TravelTime[];
  const travelTimesPm = (live.transit_travel_times_pm ?? []) as TravelTime[];

  const comparisons = (rawReport.comparisons ?? {}) as Record<string, unknown>;
  const suburbAvg = comparisons.suburb as { label?: string; avg_nzdep?: number; school_count_1500m?: number; transit_count_400m?: number; max_noise_db?: number; epb_count_300m?: number } | null;
  const cityAvg = comparisons.city as { label?: string; avg_nzdep?: number; avg_school_count_1500m?: number; avg_transit_count_400m?: number; avg_noise_db?: number; avg_epb_count_300m?: number } | null;

  const inCorrosionZone = env.in_corrosion_zone as boolean;

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

  const heritageCount = live.heritage_count_500m as number;
  const heritageListed = planning.heritage_listed as boolean;
  const heritageOverlayName = planning.heritage_overlay_name as string;
  const heritageOverlayType = planning.heritage_overlay_type as string;
  const geotechCount = hazards.geotech_count_500m as number;
  const geotechHazard = hazards.geotech_nearest_hazard as string;

  const overlays: string[] = [];
  if (planning.in_viewshaft) overlays.push(`Viewshaft${planning.viewshaft_name ? `: ${planning.viewshaft_name}` : ''}`);
  if (planning.in_ecological_area) overlays.push(`Ecological area${planning.ecological_area_name ? `: ${planning.ecological_area_name}` : ''}`);
  if (planning.in_character_precinct) overlays.push(`Character precinct${planning.character_precinct_name ? `: ${planning.character_precinct_name}` : ''}`);
  if (planning.in_special_character ?? planning.in_special_character_area) overlays.push(`Special character area${planning.special_character_name ? `: ${planning.special_character_name}` : ''}`);
  if (planning.in_mana_whenua) overlays.push(`Mana whenua${planning.mana_whenua_name ? `: ${planning.mana_whenua_name}` : ''}`);
  if (planning.in_heritage_overlay) overlays.push(`Heritage overlay${heritageOverlayName ? `: ${heritageOverlayName}` : ''}${heritageOverlayType ? ` (${heritageOverlayType})` : ''}`);

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

  const hasTransit = transitModes.length > 0 || (peakTrips != null && peakTrips > 0) || travelTimes.length > 0 || travelTimesPm.length > 0;
  const hasSafety = (crashTotal != null && crashTotal > 0) || (contamCount != null && contamCount > 0) || (geotechCount != null && geotechCount > 0);
  const hasAmenities = essentials.length > 0 || (cf && (cf.nearest_hospital || cf.libraries_2km || cf.ev_chargers_5km)) || amenityItems.length > 0;
  const hasEnvironment = (airSite && (airPm10 || airPm25)) || (waterSite && (waterDrp || waterAmmonia)) || climateTemp || climatePrecip || solarMean || inCorrosionZone;
  const hasPlanning = (heritageListed || (heritageCount && heritageCount > 0) || overlays.length > 0) || ((notableTreeCount && notableTreeCount > 0) || (parkCount && parkCount > 0)) || (transmissionDist != null && transmissionDist > 0 && transmissionDist <= 500);

  const peakBand: 'good' | 'mod' | 'poor' = peakTrips >= 20 ? 'good' : peakTrips >= 8 ? 'mod' : 'poor';
  const peakLabel = peakTrips >= 20 ? 'Excellent' : peakTrips >= 8 ? 'Good' : 'Limited';

  const supermarkets = ((snapshot as unknown as Record<string, unknown>)?.nearest_supermarkets ?? []) as NearestSupermarket[];

  return (
    <Card>
      <CardHead title="Neighbourhood Snapshot" meta={<MapPin size={16} style={{ color: 'var(--ws-piq)' }} />} />
      <div className="ws-card-body" style={{ display: 'grid' }}>
        {hasTransit && (
          <CollapsibleGroup title="Transit & Commute" defaultOpen>
            {transitModes.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <h4 style={subHeading}>{hasWalkingReach ? 'Transit Stops (10-min walk)' : 'Transit Stops (800m)'}</h4>
                  {hasWalkingReach && walkingReach.method === 'valhalla' && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 4,
                      fontSize: 9.5, fontWeight: 600,
                      background: 'rgba(13,115,119,.10)', color: 'var(--ws-piq-dark)',
                    }}>
                      Hill-adjusted
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {transitModes.map((t) => (
                    <span key={t.mode} style={{
                      padding: '4px 10px', borderRadius: 8,
                      background: 'rgba(13,115,119,.10)', color: 'var(--ws-piq-dark)',
                      fontSize: 11.5, fontWeight: 500,
                    }}>
                      {t.mode}: {t.count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {peakTrips != null && peakTrips > 0 && (
              <div style={{
                borderRadius: 'var(--ws-radius-sm)',
                border: '1px solid rgba(13,115,119,.20)',
                background: 'rgba(13,115,119,.05)',
                padding: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)' }}>
                      {Math.round(peakTrips)} services/hr at the nearest stop
                    </p>
                    {nearestStopName && (
                      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>Nearest stop: {nearestStopName}</p>
                    )}
                  </div>
                  <span style={ratePillStyle(peakBand)}>{peakLabel}</span>
                </div>
              </div>
            )}

            {travelTimes.length > 0 && (
              <div>
                <h4 style={subHeading}>
                  Morning Peak {travelTimesPm.length > 0 ? '(7-9 AM)' : 'Travel Times'}
                </h4>
                <div>
                  {travelTimes.slice(0, 8).map((t, idx) => (
                    <div key={t.destination} style={idx === 0 ? keyValueRowFirst : keyValueRow}>
                      <span style={{ fontWeight: 500, color: 'var(--ws-ink)' }}>{t.destination}</span>
                      <span style={{ color: 'var(--ws-ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(t.minutes ?? t.travel_time_min ?? 0)} min
                        {t.routes?.length
                          ? <span style={routeChip}>{t.routes[0]}</span>
                          : t.route ? <span style={routeChip}>{t.route}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {travelTimesPm.length > 0 && (
              <div>
                <h4 style={subHeading}>Evening Peak (4:30-6:30 PM)</h4>
                <div>
                  {travelTimesPm.slice(0, 8).map((t, idx) => (
                    <div key={t.destination} style={idx === 0 ? keyValueRowFirst : keyValueRow}>
                      <span style={{ fontWeight: 500, color: 'var(--ws-ink)' }}>{t.destination}</span>
                      <span style={{ color: 'var(--ws-ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(t.minutes ?? t.travel_time_min ?? 0)} min
                        {t.routes?.length
                          ? <span style={routeChip}>{t.routes[0]}</span>
                          : t.route ? <span style={routeChip}>{t.route}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ws-ink-mute)' }}>Source: GTFS schedules, updated regularly.</p>
          </CollapsibleGroup>
        )}

        {hasSafety && (
          <CollapsibleGroup title="Safety">
            {crashTotal != null && crashTotal > 0 && (
              <div>
                <h4 style={subHeading}>Road Safety (300m, 5yr)</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>
                  {crashTotal} crashes recorded nearby
                  {crashFatal ? ` including ${crashFatal} fatal` : ''}
                  {crashSerious ? ` and ${crashSerious} serious` : ''}.
                  {crashTotal > 50 ? ' This is a road safety hotspot.' : ''}
                </p>
              </div>
            )}

            {contamCount != null && contamCount > 0 && (
              <div style={{
                borderRadius: 'var(--ws-radius-sm)',
                border: '1px solid rgba(213,94,0,.30)',
                background: 'rgba(213,94,0,.05)',
                padding: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertTriangle size={16} style={{ color: 'var(--ws-r-high)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ws-r-high)' }}>Contaminated Land</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)' }}>
                      {contamName ? `${contamName}. ${Math.round(contamDist || 0)} m away` : `${contamCount} site${contamCount !== 1 ? 's' : ''} in area (2km)`}.
                      {contamCat && ` Category: ${contamCat}.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {geotechCount != null && geotechCount > 0 && (
              <div>
                <h4 style={subHeading}>Geotechnical Reports</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>
                  {geotechCount} geotech report{geotechCount > 1 ? 's' : ''} filed nearby (500m).
                  {geotechHazard && ` Nearest report hazard: ${geotechHazard}.`}
                  {' '}Existing reports can indicate known ground conditions and save on investigation costs.
                </p>
              </div>
            )}
          </CollapsibleGroup>
        )}

        {hasAmenities && (
          <CollapsibleGroup title="Amenities">
            {essentials.length > 0 && (
              <div>
                <h4 style={subHeading}>Nearest Essentials</h4>
                <div>
                  {essentials.map((e, idx) => (
                    <div key={e.label} style={idx === 0 ? keyValueRowFirst : keyValueRow}>
                      <span style={{ fontWeight: 500, color: 'var(--ws-ink)' }}>{e.label}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>{e.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cf && (cf.nearest_hospital || cf.libraries_2km || cf.ev_chargers_5km) && (
              <div>
                <h4 style={subHeading}>Community Facilities</h4>
                <div>
                  {(() => {
                    const rows: { label: string; value: React.ReactNode }[] = [];
                    if (cf.nearest_hospital) rows.push({ label: 'Hospital', value: `${cf.nearest_hospital.name}. ${Math.round(cf.nearest_hospital.distance_m / 1000)}km` });
                    if (cf.nearest_ev_charger) rows.push({
                      label: 'EV Charger',
                      value: `${cf.nearest_ev_charger.name || 'Charger'}. ${cf.nearest_ev_charger.distance_m < 1000 ? `${Math.round(cf.nearest_ev_charger.distance_m)}m` : `${(cf.nearest_ev_charger.distance_m / 1000).toFixed(1)}km`}${cf.ev_chargers_5km ? ` (${cf.ev_chargers_5km} wider area (5km))` : ''}`,
                    });
                    if ((cf.libraries_2km ?? 0) > 0) rows.push({ label: 'Libraries', value: `${cf.libraries_2km} local (2km)` });
                    if ((cf.sports_facilities_2km ?? 0) > 0) rows.push({ label: 'Sports / Pools', value: `${cf.sports_facilities_2km} local (2km)` });
                    if ((cf.playgrounds_2km ?? 0) > 0) rows.push({ label: 'Playgrounds', value: `${cf.playgrounds_2km} local (2km)` });
                    if ((cf.community_centres_2km ?? 0) > 0) rows.push({ label: 'Community Centres', value: `${cf.community_centres_2km} local (2km)` });
                    if ((cf.cycling_facilities_2km ?? 0) > 0) rows.push({ label: 'Cycling (parking/rental/repair)', value: `${cf.cycling_facilities_2km} local (2km)` });
                    if (cf.cycleway_km_2km != null && cf.cycleway_km_2km > 0) {
                      const km = cf.cycleway_km_2km;
                      rows.push({
                        label: 'Cycle paths nearby',
                        value: km >= 10
                          ? <><span style={{ color: 'var(--ws-success)', fontWeight: 500 }}>{km}km</span>. excellent cycling network</>
                          : km >= 3
                            ? <><span style={{ color: 'var(--ws-piq)', fontWeight: 500 }}>{km}km</span>. good cycling options</>
                            : <>{km}km of cycle paths</>,
                      });
                    }
                    if (cf.fibre_available != null) rows.push({
                      label: 'Fibre broadband',
                      value: <span style={{ fontWeight: 500, color: cf.fibre_available ? 'var(--ws-success)' : 'var(--ws-r-high)' }}>
                        {cf.fibre_available ? `Available (${cf.fibre_provider || 'provider'})` : 'Not in fibre area'}
                      </span>,
                    });
                    return rows.map((r, idx) => (
                      <div key={r.label} style={idx === 0 ? keyValueRowFirst : keyValueRow}>
                        <span style={{ fontWeight: 500, color: 'var(--ws-ink)' }}>{r.label}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>{r.value}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {supermarkets.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <ShoppingCart size={16} style={{ color: 'var(--ws-ink-mute)' }} />
                  <h4 style={subHeading}>Nearest Supermarkets</h4>
                </div>
                <div>
                  {supermarkets.map((s, i) => (
                    <div key={i} style={i === 0 ? keyValueRowFirst : keyValueRow}>
                      <span style={{ fontWeight: 500, color: 'var(--ws-ink)' }}>{s.name}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>
                        {s.distance_m >= 1000 ? `${(s.distance_m / 1000).toFixed(1)} km` : `${Math.round(s.distance_m)} m`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {amenityItems.length > 0 && (
              <div>
                <h4 style={subHeading}>Amenities nearby (500m)</h4>
                <div style={{ display: 'grid', gap: 6 }}>
                  {amenityItems.map((a) => (
                    <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--ws-ink-soft)', width: 96, textAlign: 'right', flexShrink: 0 }}>{a.name}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--ws-bg-2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, background: 'var(--ws-piq)', width: `${(a.count / maxAmenity) * 100}%` }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ws-piq)', width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {amenityItems.length === 0 && Object.keys(amenities500m).length === 0 && essentials.length > 0 && (
              <div>
                <h4 style={subHeading}>Amenities nearby (500m)</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)' }}>No commercial amenities mapped nearby (500m). Nearest essentials shown above.</p>
              </div>
            )}
          </CollapsibleGroup>
        )}

        {hasEnvironment && (
          <CollapsibleGroup title="Environment">
            {airSite && (airPm10 || airPm25) && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Wind size={16} style={{ color: 'var(--ws-ink-mute)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={subHeading}>Air Quality</h4>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>
                    Monitoring: {airSite}{airDistKm ? ` (${airDistKm} km away)` : ''}.
                    {airPm10 && ` PM10 trend: ${airPm10.toLowerCase()}.`}
                    {airPm25 && ` PM2.5 trend: ${airPm25.toLowerCase()}.`}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)', fontStyle: 'italic' }}>
                    Regional indicator from the nearest LAWA station, not a reading at this property.
                  </p>
                </div>
              </div>
            )}

            {waterSite && (waterDrp || waterAmmonia) && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Droplets size={16} style={{ color: 'var(--ws-ink-mute)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={subHeading}>Water Quality</h4>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>
                    Nearest: {waterSite}{waterDistKm ? ` (${waterDistKm} km away)` : ''}.
                    {waterDrp && ` Nutrient level: Grade ${waterDrp}.`}
                    {waterAmmonia && ` Ammonia: Grade ${waterAmmonia}.`}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)', fontStyle: 'italic' }}>
                    Surface water at the nearest LAWA river/stream site, not drinking water at this property.
                  </p>
                </div>
              </div>
            )}

            {(climateTemp || climatePrecip || solarMean) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                {climateTemp != null && (
                  <div style={metricBoxStyle}>
                    <p style={metricLabel}>Warming 2050</p>
                    <p style={metricValue}>+{(typeof climateTemp === 'number' ? climateTemp.toFixed(1) : climateTemp)}&deg;C</p>
                    <p style={metricHint}>projected</p>
                  </div>
                )}
                {climatePrecip != null && (
                  <div style={metricBoxStyle}>
                    <p style={metricLabel}>Rainfall 2050</p>
                    <p style={metricValue}>{climatePrecip > 0 ? '+' : ''}{(typeof climatePrecip === 'number' ? climatePrecip.toFixed(0) : climatePrecip)}%</p>
                    <p style={metricHint}>change</p>
                  </div>
                )}
                {solarMean != null && (
                  <div style={metricBoxStyle}>
                    <p style={metricLabel}>Solar Potential</p>
                    <p style={metricValue}>{Math.round(solarMean)} kWh/yr</p>
                    <p style={metricHint}>avg radiation</p>
                  </div>
                )}
              </div>
            )}

            {inCorrosionZone && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)' }}>
                <span style={{ fontWeight: 500, color: 'var(--ws-ink)' }}>Corrosion zone:</span> This area has higher corrosion risk. affects exterior paint and metalwork choices.
              </p>
            )}
          </CollapsibleGroup>
        )}

        {hasPlanning && (
          <CollapsibleGroup title="Planning">
            {(heritageListed || (heritageCount && heritageCount > 0) || overlays.length > 0) && (
              <div>
                <h4 style={subHeading}>Heritage & Overlays</h4>
                <div style={{ fontSize: 12, color: 'var(--ws-ink-soft)', display: 'grid', gap: 2 }}>
                  {heritageListed && <p style={{ margin: 0, fontWeight: 500, color: 'var(--ws-r-high)' }}>This property is heritage-listed.</p>}
                  {heritageCount > 0 && (
                    <p style={{ margin: 0 }}>
                      {heritageCount} heritage item{heritageCount > 1 ? 's' : ''} nearby (500m)
                      {heritageCount >= 50
                        ? '. dense heritage area. Development restrictions likely apply to surrounding buildings.'
                        : heritageCount >= 10
                          ? '. Heritage-rich neighbourhood. check for view protection or character area rules.'
                          : '.'}
                    </p>
                  )}
                  {overlays.length > 0 && <p style={{ margin: 0 }}>Planning overlays: {overlays.join(', ')}.</p>}
                </div>
              </div>
            )}

            {((notableTreeCount && notableTreeCount > 0) || (parkCount && parkCount > 0)) && (
              <div>
                <h4 style={subHeading}>Green Space & Trees</h4>
                <div style={{ fontSize: 12, color: 'var(--ws-ink-soft)', display: 'grid', gap: 2 }}>
                  {notableTreeCount > 0 && (
                    <p style={{ margin: 0 }}>
                      {notableTreeCount} notable/protected tree{notableTreeCount > 1 ? 's' : ''} nearby (50m).
                      {notableTreeNearest?.name && ` Nearest: ${notableTreeNearest.name}${notableTreeNearest.tree_type ? ` (${notableTreeNearest.tree_type})` : ''}.`}
                      {' '}Protected trees cannot be removed. check before planning building work.
                    </p>
                  )}
                  {parkCount > 0 && <p style={{ margin: 0 }}>{parkCount} park{parkCount > 1 ? 's' : ''} nearby (500m).</p>}
                </div>
              </div>
            )}

            {transmissionDist != null && transmissionDist > 0 && transmissionDist <= 500 && (
              <div style={{
                borderRadius: 'var(--ws-radius-sm)',
                border: `1px solid ${transmissionDist <= 100 ? 'rgba(196,45,45,.30)' : transmissionDist <= 200 ? 'rgba(213,94,0,.30)' : 'var(--ws-rule)'}`,
                background: transmissionDist <= 100 ? 'rgba(196,45,45,.05)' : transmissionDist <= 200 ? 'rgba(213,94,0,.05)' : 'transparent',
                padding: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertTriangle size={16} style={{
                    color: transmissionDist <= 100 ? 'var(--ws-r-vhigh)' : transmissionDist <= 200 ? 'var(--ws-r-high)' : 'var(--ws-ink-mute)',
                    flexShrink: 0, marginTop: 2,
                  }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)' }}>
                      High-voltage transmission line. {Math.round(transmissionDist)} m away
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)' }}>
                      {transmissionDist <= 100
                        ? 'Very close proximity. May affect property value, building restrictions, and insurance. Check Transpower corridor requirements.'
                        : transmissionDist <= 200
                          ? 'Nearby transmission infrastructure. Consider potential EMF exposure and building height restrictions.'
                          : 'Transmission line nearby (500m). Generally low impact at this distance.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CollapsibleGroup>
        )}

        {ratesData?.total_rates != null && ratesData.total_rates > 0 && (
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--ws-rule)' }}>
            <div style={{
              borderRadius: 'var(--ws-radius-sm)',
              border: '1px solid var(--ws-rule)',
              padding: 14,
            }}>
              <h4 style={subHeading}>Annual Council Rates</h4>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--ws-piq)' }}>
                ${ratesData.total_rates.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ws-ink-mute)', marginLeft: 4 }}>/year</span>
              </p>
              {ratesData.rates_breakdown && ratesData.rates_breakdown.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {ratesData.rates_breakdown.slice(0, 6).map((item, i) => (
                    <div key={i} style={i === 0 ? keyValueRowFirst : keyValueRow}>
                      <span style={{ color: 'var(--ws-ink-soft)', fontSize: 11.5 }}>{item.name}</span>
                      <span style={{ fontWeight: 500, color: 'var(--ws-ink)', fontSize: 11.5 }}>
                        ${item.amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--ws-ink-mute)' }}>
                Source: Council rates API. Amounts may differ from your actual rates notice.
              </p>
            </div>
          </div>
        )}

        {(suburbAvg || cityAvg) && (
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--ws-rule)' }}>
            <h4 style={subHeading}>Area Benchmarks</h4>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--ws-ink-mute)' }}>
              Suburb vs city averages. use as context alongside the property-specific numbers above.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--ws-rule)' }}>
                    <th style={{ ...benchTh, textAlign: 'left' }}>Metric</th>
                    {suburbAvg?.label && <th style={{ ...benchTh, textAlign: 'center' }}>{suburbAvg.label}</th>}
                    {cityAvg?.label && <th style={{ ...benchTh, textAlign: 'center' }}>{cityAvg.label}</th>}
                  </tr>
                </thead>
                <tbody>
                  {suburbAvg?.avg_nzdep != null && (
                    <tr style={benchRow}>
                      <td style={benchTd}>Avg Deprivation</td>
                      {suburbAvg && <td style={{ ...benchTd, textAlign: 'center', fontWeight: 500, color: 'var(--ws-ink)' }}>{suburbAvg.avg_nzdep?.toFixed(1)}</td>}
                      {cityAvg && <td style={{ ...benchTd, textAlign: 'center', fontWeight: 500, color: 'var(--ws-ink)' }}>{cityAvg.avg_nzdep?.toFixed(1) ?? '–'}</td>}
                    </tr>
                  )}
                  {(suburbAvg?.school_count_1500m != null || cityAvg?.avg_school_count_1500m != null) && (
                    <tr style={benchRow}>
                      <td style={benchTd}>Schools (1.5km)</td>
                      {suburbAvg && <td style={{ ...benchTd, textAlign: 'center', fontWeight: 500, color: 'var(--ws-ink)' }}>{suburbAvg.school_count_1500m ?? '–'}</td>}
                      {cityAvg && <td style={{ ...benchTd, textAlign: 'center', fontWeight: 500, color: 'var(--ws-ink)' }}>{cityAvg.avg_school_count_1500m?.toFixed(0) ?? '–'}</td>}
                    </tr>
                  )}
                  {(suburbAvg?.transit_count_400m != null || cityAvg?.avg_transit_count_400m != null) && (
                    <tr style={benchRow}>
                      <td style={benchTd}>Transit (400m)</td>
                      {suburbAvg && <td style={{ ...benchTd, textAlign: 'center', fontWeight: 500, color: 'var(--ws-ink)' }}>{suburbAvg.transit_count_400m ?? '–'}</td>}
                      {cityAvg && <td style={{ ...benchTd, textAlign: 'center', fontWeight: 500, color: 'var(--ws-ink)' }}>{cityAvg.avg_transit_count_400m?.toFixed(0) ?? '–'}</td>}
                    </tr>
                  )}
                  {(suburbAvg?.max_noise_db != null || cityAvg?.avg_noise_db != null) && (
                    <tr style={benchRow}>
                      <td style={benchTd}>Road Noise (dB)</td>
                      {suburbAvg && <td style={{ ...benchTd, textAlign: 'center', fontWeight: 500, color: 'var(--ws-ink)' }}>{suburbAvg.max_noise_db?.toFixed(0) ?? '–'}</td>}
                      {cityAvg && <td style={{ ...benchTd, textAlign: 'center', fontWeight: 500, color: 'var(--ws-ink)' }}>{cityAvg.avg_noise_db?.toFixed(0) ?? '–'}</td>}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

const metricBoxStyle: React.CSSProperties = {
  borderRadius: 'var(--ws-radius-sm)',
  border: '1px solid var(--ws-rule)',
  padding: 12,
  textAlign: 'center',
};
const metricLabel: React.CSSProperties = {
  margin: 0, fontSize: 10.5, color: 'var(--ws-ink-mute)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
const metricValue: React.CSSProperties = {
  margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--ws-ink)',
};
const metricHint: React.CSSProperties = {
  margin: 0, fontSize: 11, color: 'var(--ws-ink-mute)',
};
const benchTh: React.CSSProperties = {
  padding: '6px 8px', fontSize: 11.5, fontWeight: 600, color: 'var(--ws-piq-dark)',
};
const benchTd: React.CSSProperties = { padding: '6px 8px', color: 'var(--ws-ink-soft)' };
const benchRow: React.CSSProperties = { borderBottom: '1px solid var(--ws-rule)' };
