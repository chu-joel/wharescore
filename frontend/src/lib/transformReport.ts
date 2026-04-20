// lib/transformReport.ts. maps raw API response to frontend PropertyReport type
//
// The backend returns a different shape than the frontend types expect.
// This transform bridges the gap so components get the shape they need.

import type {
  PropertyReport,
  CategoryScore,
  CoverageInfo,
  ComparisonData,
  RatingBin,
  LiveabilityData,
  PlanningData,
  MarketData,
  HazardData,
  EnvironmentData,
} from './types';
import { getRatingBin } from './constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Map of backend category keys → frontend category names */
const CATEGORY_MAP: Record<string, CategoryScore['name']> = {
  hazards: 'risk',
  environment: 'risk', // folded into risk for display
  liveability: 'liveability',
  market: 'market',
  transport: 'transport',
  planning: 'planning',
};

function toRatingBin(score: number): RatingBin {
  return getRatingBin(score).rating;
}

// --- Indicator display labels. overrides the naive title-case for abbreviations ---
// Keys are backend indicator keys; values are the user-facing label.
// Anything not listed falls through to snake_case → Title Case.
const INDICATOR_LABELS: Record<string, string> = {
  nzdep: 'NZDep',
  cbd_proximity: 'CBD Proximity',
  epb: 'Earthquake-Prone Buildings',
  air_quality: 'Air Quality',
  water_quality: 'Water Quality',
  contaminated_land: 'Contaminated Land',
  school_zone: 'School Zoning',
  transit_access: 'Transit Access',
  commute_frequency: 'Commute Frequency',
  rail_proximity: 'Rail Proximity',
  bus_density: 'Bus Density',
  road_safety: 'Road Safety',
  rental_fairness: 'Rental Fairness',
  rental_trend: 'Rental Trend',
  market_heat: 'Market Heat',
  zone_permissiveness: 'Zoning',
  height_limit: 'Height Limit',
  resource_consents: 'Resource Consents',
  coastal_erosion: 'Coastal Erosion',
  ground_shaking: 'Ground Shaking',
  fault_zone: 'Fault Zone',
  slope_failure: 'Slope Failure',
  overland_flow: 'Overland Flow Path',
  aircraft_noise: 'Aircraft Noise',
  landslide_susceptibility: 'Landslide Susceptibility',
};

function indicatorLabel(key: string): string {
  if (INDICATOR_LABELS[key]) return INDICATOR_LABELS[key];
  // Fallback: snake_case → Title Case.
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Indicator → category mapping ---
const INDICATOR_CATEGORIES: Record<string, string> = {
  flood: 'risk', tsunami: 'risk', liquefaction: 'risk', earthquake: 'risk',
  coastal_erosion: 'risk', wind: 'risk', wildfire: 'risk', epb: 'risk', slope_failure: 'risk',
  noise: 'risk', air_quality: 'risk', water_quality: 'risk',
  climate: 'risk', contaminated_land: 'risk',
  nzdep: 'liveability', schools: 'liveability', school_zone: 'liveability',
  heritage: 'liveability',
  transit_access: 'transport', cbd_proximity: 'transport', commute_frequency: 'transport',
  rail_proximity: 'transport', bus_density: 'transport', road_safety: 'transport',
  // Legacy fallback
  transit: 'transport', crashes: 'transport',
  zone_permissiveness: 'planning',
  height_limit: 'planning', resource_consents: 'planning',
  infrastructure: 'planning',
};

/**
 * Build CategoryScore[] from the backend's flat objects.
 */
function buildCategories(
  catScores: Record<string, number> | undefined,
  indicators: Record<string, number> | undefined,
): CategoryScore[] {
  if (!catScores || typeof catScores !== 'object') return [];

  const indicatorsByCategory: Record<string, { name: string; score: number }[]> = {};
  if (indicators && typeof indicators === 'object') {
    for (const [key, score] of Object.entries(indicators)) {
      if (typeof score !== 'number') continue;
      const cat = INDICATOR_CATEGORIES[key] ?? 'risk';
      (indicatorsByCategory[cat] ??= []).push({ name: key, score });
    }
  }

  // Merge hazards + environment into 'risk'
  const merged: Record<string, number> = {};
  for (const [backendKey, score] of Object.entries(catScores)) {
    if (typeof score !== 'number') continue;
    const frontendName = CATEGORY_MAP[backendKey] ?? backendKey;
    if (merged[frontendName] !== undefined) {
      merged[frontendName] = (merged[frontendName] + score) / 2;
    } else {
      merged[frontendName] = score;
    }
  }

  // Synthesize 'transport' category from transport indicators if backend didn't provide it
  if (!merged['transport'] && indicatorsByCategory['transport']?.length) {
    const transportInds = indicatorsByCategory['transport'];
    const avg = transportInds.reduce((sum, i) => sum + i.score, 0) / transportInds.length;
    merged['transport'] = avg;
  }

  // Synthesize 'market' category from market indicators if backend didn't provide it
  if (!merged['market'] && indicatorsByCategory['market']?.length) {
    const marketInds = indicatorsByCategory['market'];
    const avg = marketInds.reduce((sum, i) => sum + i.score, 0) / marketInds.length;
    merged['market'] = avg;
  }

  return Object.entries(merged).map(([name, score]) => ({
    name: name as CategoryScore['name'],
    score,
    rating: toRatingBin(score),
    indicators: (indicatorsByCategory[name] ?? []).map((ind) => ({
      name: indicatorLabel(ind.name),
      score: ind.score,
      rating: toRatingBin(ind.score),
      value: `${Math.round(ind.score)}/100`,
      source: '',
      updated: '',
      is_available: true,
    })),
  }));
}

// --- Section data transforms ---

function transformLiveability(raw: any): LiveabilityData {
  if (!raw) return {} as LiveabilityData;
  return {
    nzdep_score: raw.nzdep_decile ?? null,
    crime_rate: raw.crime_percentile ?? null,
    crime_victimisations: raw.crime_victimisations ?? null,
    crime_city_median: raw.crime_city_median ?? null,
    school_count: Array.isArray(raw.schools_1500m) ? raw.schools_1500m.length : null,
    transit_count: raw.transit_stops_400m ?? null,
    amenity_count: raw.amenities_500m
      ? Object.values(raw.amenities_500m as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
      : null,
    cbd_distance_m: raw.cbd_distance_m ?? null,
    nearest_train_m: raw.nearest_train_distance_m ?? null,
    nearest_train_name: raw.nearest_train_name ?? null,
    // Metlink mode breakdown
    bus_stops_800m: raw.bus_stops_800m ?? null,
    rail_stops_800m: raw.rail_stops_800m ?? null,
    ferry_stops_800m: raw.ferry_stops_800m ?? null,
    cable_car_stops_800m: raw.cable_car_stops_800m ?? null,
    // Transit travel times
    transit_travel_times: Array.isArray(raw.transit_travel_times) ? raw.transit_travel_times : null,
    transit_travel_times_pm: Array.isArray(raw.transit_travel_times_pm) ? raw.transit_travel_times_pm : null,
    peak_trips_per_hour: raw.peak_trips_per_hour ?? null,
    nearest_stop_name: raw.nearest_stop_name ?? null,
    // Walking reach (10-min walk via Valhalla)
    walking_reach_10min: raw.walking_reach_10min ?? null,
    walking_reach_method: raw.walking_reach_method ?? null,
    // Nearest essentials. preserve the {name, distance_m} shape from SQL
    nearest_gp: raw.nearest_gp && typeof raw.nearest_gp === 'object'
      ? { name: raw.nearest_gp.name ?? '', distance_m: Number(raw.nearest_gp.distance_m) || 0 }
      : null,
    nearest_pharmacy: raw.nearest_pharmacy && typeof raw.nearest_pharmacy === 'object'
      ? { name: raw.nearest_pharmacy.name ?? '', distance_m: Number(raw.nearest_pharmacy.distance_m) || 0 }
      : null,
  };
}

function transformPlanning(raw: any, liveabilityRaw: any, environmentRaw: any): PlanningData {
  if (!raw) return {} as PlanningData;
  return {
    zone_name: raw.zone_name ?? null,
    zone_code: raw.zone_code ?? null,
    zone_category: raw.zone_category ?? null,
    height_limit: raw.max_height_m ?? null,
    heritage_count: liveabilityRaw?.heritage_count_500m ?? null,
    consent_count: raw.resource_consents_500m_2yr ?? null,
    infrastructure_count: Array.isArray(raw.infrastructure_5km) ? raw.infrastructure_5km.length : null,
    contamination_count: raw?.contam_count_500m ?? environmentRaw?.contam_count_2km ?? environmentRaw?.contam_count_500m ?? null,
    epb_listed: raw.epb_listed ?? null,
    // Viewshafts
    in_viewshaft: raw.in_viewshaft ?? null,
    viewshaft_name: raw.viewshaft_name ?? null,
    viewshaft_significance: raw.viewshaft_significance ?? null,
    // Character precincts
    in_character_precinct: raw.in_character_precinct ?? null,
    character_precinct_name: raw.character_precinct_name ?? null,
    // Heritage overlay
    in_heritage_overlay: raw.in_heritage_overlay ?? null,
    heritage_overlay_name: raw.heritage_overlay_name ?? null,
    heritage_overlay_type: raw.heritage_overlay_type ?? null,
    // Special character area
    in_special_character_area: raw.in_special_character ?? raw.in_special_character_area ?? null,
    special_character_name: raw.special_character_name ?? null,
    // Notable trees
    notable_tree_count_50m: raw.notable_trees_50m ?? raw.notable_tree_count_50m ?? null,
    notable_tree_nearest: raw.notable_tree_nearest ?? null,
    // Significant ecological area
    in_ecological_area: raw.in_ecological_area ?? null,
    ecological_area_name: raw.ecological_area_name ?? null,
    ecological_area_type: raw.ecological_area_type ?? null,
    // Mana whenua
    in_mana_whenua: raw.in_mana_whenua ?? null,
    mana_whenua_name: raw.mana_whenua_name ?? null,
    // Height variation
    height_variation_limit: raw.height_variation_limit ?? null,
    // Parks
    park_count_500m: raw.park_count_500m ?? null,
    nearest_park_name: raw.nearest_park_name ?? null,
    nearest_park_distance_m: raw.nearest_park_distance_m ?? null,
  };
}

function transformHazards(raw: any): HazardData {
  if (!raw) return {} as HazardData;

  // Extract MBIE EPB detail if present
  const epbNearest = raw.epb_nearest;

  return {
    flood_zone: raw.flood ?? null,
    tsunami_zone: raw.tsunami_evac_zone ?? raw.tsunami_zone_class?.toString() ?? raw.council_tsunami_ranking ?? raw.wcc_tsunami_ranking ?? null,
    liquefaction_zone: raw.liquefaction ?? raw.council_liquefaction ?? null,
    fault_distance_m: null, // not in API
    earthquake_count: raw.earthquake_count_30km ?? null,
    earthquake_max_mag: raw.earthquake_max_mag ?? null,
    coastal_erosion: raw.coastal_exposure ?? raw.coastal_erosion_exposure ?? null,
    wildfire_risk: raw.wildfire_trend ?? null,
    wildfire_vhe_days: raw.wildfire_vhe_days ?? null,
    epb_count: raw.epb_count_300m ?? null,
    slope_failure: raw.slope_failure ?? raw.council_slope_severity ?? null,
    contamination_count: null, // see post-transform mirror below. source of truth is planning
    // Wellington-specific
    earthquake_hazard_index: raw.earthquake_hazard_index ?? null,
    earthquake_hazard_grade: raw.earthquake_hazard_grade ?? null,
    ground_shaking_zone: raw.ground_shaking_zone ?? null,
    ground_shaking_severity: raw.ground_shaking_severity ?? null,
    gwrc_liquefaction: raw.gwrc_liquefaction ?? null,
    gwrc_liquefaction_geology: raw.gwrc_liquefaction_geology ?? null,
    gwrc_slope_severity: raw.gwrc_slope_severity ?? null,
    fault_zone_name: raw.fault_zone_name ?? null,
    fault_zone_ranking: raw.fault_zone_ranking ?? null,
    wcc_flood_type: raw.wcc_flood_type ?? null,
    wcc_flood_ranking: raw.wcc_flood_ranking ?? null,
    wcc_tsunami_return_period: raw.wcc_tsunami_return_period ?? null,
    wcc_tsunami_ranking: raw.wcc_tsunami_ranking ?? null,
    // Council-specific regional hazard data (all cities)
    council_liquefaction: raw.council_liquefaction ?? null,
    council_liquefaction_geology: raw.council_liquefaction_geology ?? null,
    council_liquefaction_source: raw.council_liquefaction_source ?? null,
    council_tsunami_ranking: raw.council_tsunami_ranking ?? null,
    council_tsunami_scenario: raw.council_tsunami_scenario ?? null,
    council_tsunami_return_period: raw.council_tsunami_return_period ?? null,
    council_tsunami_source: raw.council_tsunami_source ?? null,
    council_slope_severity: raw.council_slope_severity ?? null,
    council_slope_source: raw.council_slope_source ?? null,
    epb_rating: epbNearest?.rating ?? null,
    epb_construction_type: epbNearest?.construction_type ?? null,
    epb_deadline: epbNearest?.deadline ?? null,
    solar_mean_kwh: raw.solar_mean_kwh ?? null,
    solar_max_kwh: raw.solar_max_kwh ?? null,
    // GNS Landslide Database
    landslide_count_500m: raw.landslide_count_500m ?? raw.landslide_events_1km ?? null,
    landslide_nearest: raw.landslide_nearest ?? null,
    landslide_in_area: raw.landslide_in_area ?? null,
    // GNS Active Faults (national)
    active_fault_nearest: raw.active_fault_nearest ?? null,
    fault_avoidance_zone: raw.fault_avoidance_zone ?? null,
    // Landslide susceptibility (council data)
    landslide_susceptibility_rating: raw.landslide_susceptibility_rating ?? null,
    landslide_susceptibility_type: raw.landslide_susceptibility_type ?? null,
    // Overland flow path
    on_overland_flow_path: raw.on_overland_flow_path ?? raw.overland_flow_within_50m ?? null,
    overland_flow_within_50m: raw.overland_flow_within_50m ?? raw.on_overland_flow_path ?? null,
    // Coastal erosion (council data)
    coastal_erosion_exposure: raw.coastal_erosion_exposure ?? null,
    coastal_erosion_timeframe: raw.coastal_erosion_timeframe ?? null,
    council_coastal_erosion: raw.council_coastal_erosion ?? null,
    // Aircraft noise
    aircraft_noise_name: raw.aircraft_noise_name ?? null,
    aircraft_noise_dba: raw.aircraft_noise_dba ?? null,
    aircraft_noise_category: raw.aircraft_noise_category ?? null,
    // Coastal elevation
    coastal_elevation_cm: raw.coastal_elevation_cm ?? null,
    // Flood extent (AEP-based)
    flood_extent_aep: raw.flood_extent_aep ?? null,
    flood_extent_label: raw.flood_extent_label ?? null,
    flood_nearest_m: raw.flood_nearest_m ?? null,
    // Geotechnical reports
    geotech_count_500m: raw.geotech_count_500m ?? null,
    geotech_nearest_hazard: raw.geotech_nearest_hazard ?? null,
    // Coastal inundation
    coastal_inundation_ranking: raw.coastal_inundation_ranking ?? null,
    coastal_inundation_scenario: raw.coastal_inundation_scenario ?? null,
    on_erosion_prone_land: raw.on_erosion_prone_land ?? null,
    erosion_min_angle: raw.erosion_min_angle ?? null,
  };
}

function transformEnvironment(raw: any, hazardsRaw: any): EnvironmentData {
  if (!raw) return {} as EnvironmentData;
  return {
    wind_zone: hazardsRaw?.wind_zone ?? raw.wind_zone ?? null,
    noise_db: raw.noise_db ?? raw.road_noise_db ?? null,
    air_quality_trend: raw.air_quality_pm10_trend ?? raw.air_pm10_trend ?? raw.air_pm25_trend ?? null,
    air_quality_site: raw.air_quality_site ?? raw.air_site_name ?? null,
    air_quality_distance_m: raw.air_pm10_distance_m ?? raw.air_distance_m ?? null,
    water_quality_grade: raw.water_quality_ecoli_band ?? raw.water_drp_band ?? null,
    water_site_name: raw.water_site_name ?? null,
    water_ecoli_band: raw.water_ecoli_band ?? null,
    water_ammonia_band: raw.water_ammonia_band ?? null,
    water_clarity_band: raw.water_clarity_band ?? null,
    water_nitrate_band: raw.water_nitrate_band ?? null,
    in_corrosion_zone: raw.in_corrosion_zone ?? null,
    in_rail_vibration_area: raw.in_rail_vibration_area ?? null,
    rail_vibration_type: raw.rail_vibration_type ?? null,
    climate_temp_change: raw.climate_temp_change ?? null,
    climate_precip_change_pct: raw.climate_rainfall_change ?? raw.climate_precip_change_pct ?? null,
  };
}

function transformMarket(raw: any): MarketData {
  if (!raw) return {} as MarketData;

  // Build rent_assessment from rental_overview. pick the "ALL" dwelling type, "ALL" beds row
  let rentAssessment = null;
  if (Array.isArray(raw.rental_overview)) {
    const allRow = raw.rental_overview.find(
      (r: any) => r.dwelling_type === 'ALL' && r.beds === 'ALL',
    );
    if (allRow) {
      rentAssessment = {
        median: allRow.median,
        lower_quartile: allRow.lq,
        upper_quartile: allRow.uq,
        bond_count: allRow.bonds ?? 0,
        dwelling_type: allRow.dwelling_type,
        bedrooms: allRow.beds,
        confidence_stars: Math.min(5, Math.max(1, Math.ceil((allRow.bonds ?? 0) / 20))) as 1|2|3|4|5,
        user_percentile: null,
        is_outlier: false,
      };
    }
  }

  // Build trend from trends array. pick the "ALL"/"ALL" row.
  // Rent series for small SA2s are volatile and occasionally show extreme
  // outliers (e.g. -31%/yr) that reflect a data gap, not a real market move.
  // Suppress anything outside +/- 25% for the headline 1yr number and
  // +/- 15% for the 5/10yr compound figures. those ranges cover every
  // genuine Wellington/Auckland movement in the past 20 years with margin.
  const sanitiseCagr = (v: unknown, clamp: number): number | null => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    if (Math.abs(v) > clamp) return null;
    return v;
  };
  let trend = null;
  if (Array.isArray(raw.trends)) {
    const allTrend = raw.trends.find(
      (t: any) => t.dwelling_type === 'ALL' && t.beds === 'ALL',
    );
    if (allTrend) {
      trend = {
        cagr_1yr: sanitiseCagr(allTrend.yoy_pct, 25),
        cagr_5yr: sanitiseCagr(allTrend.cagr_5yr, 15),
        cagr_10yr: sanitiseCagr(allTrend.cagr_10yr, 15),
      };
    }
  }

  // Derive market heat from 1yr rent trend + bond volume
  const yoy = trend?.cagr_1yr;
  const bonds = rentAssessment?.bond_count ?? 0;
  let market_heat: 'cold' | 'cool' | 'neutral' | 'warm' | 'hot' = 'neutral';
  if (yoy != null) {
    if (yoy >= 8 || (yoy >= 5 && bonds >= 50)) market_heat = 'hot';
    else if (yoy >= 4) market_heat = 'warm';
    else if (yoy <= -4) market_heat = 'cold';
    else if (yoy <= -1) market_heat = 'cool';
  }

  return {
    rent_assessment: rentAssessment,
    trend,
    market_heat,
  };
}

function transformComparisons(raw: any): ComparisonData | undefined {
  if (!raw) return undefined;
  const mapAvgs = (s: any) => s ? {
    label: s.label ?? '',
    avg_nzdep: s.avg_nzdep ?? null,
    school_count_1500m: s.school_count_1500m ?? s.avg_school_count_1500m ?? null,
    transit_count_400m: s.transit_count_400m ?? s.avg_transit_count_400m ?? null,
    max_noise_db: s.max_noise_db ?? s.avg_noise_db ?? null,
    epb_count_300m: s.epb_count_300m ?? s.avg_epb_count_300m ?? null,
  } : null;
  return {
    suburb: mapAvgs(raw.suburb),
    city: mapAvgs(raw.city),
  };
}

// --- Computed contextual fields ---

export interface ComputedContext {
  crime_vs_city_pct: number | null;
  rent_vs_area: 'above' | 'below' | 'at' | null;
  nzdep_context: string | null;
}

function computeContext(liveability: LiveabilityData, market: MarketData): ComputedContext {
  // Crime vs city as percentage
  let crime_vs_city_pct: number | null = null;
  if (liveability.crime_victimisations != null && liveability.crime_city_median != null && liveability.crime_city_median > 0) {
    crime_vs_city_pct = Math.round(((liveability.crime_victimisations / liveability.crime_city_median) - 1) * 100);
  }

  // NZDep context text
  let nzdep_context: string | null = null;
  if (liveability.nzdep_score != null) {
    const pct = liveability.nzdep_score * 10;
    nzdep_context = liveability.nzdep_score <= 5
      ? `Less deprived than ${100 - pct}% of the country`
      : `More deprived than ${100 - pct}% of the country`;
  }

  // Rent vs area median. currently no per-listing rent to compare
  const rent_vs_area: 'above' | 'below' | 'at' | null = null;

  return { crime_vs_city_pct, rent_vs_area, nzdep_context };
}

/**
 * Transform the raw API response into the shape the frontend components expect.
 */
export function transformReport(raw: any): PropertyReport {
  const scores = raw.scores ?? {};
  const rawCategories = scores.categories;
  const rawIndicators = scores.indicators;

  // Build coverage from scores.coverage (backend nests it there)
  const rawCoverage = scores.coverage;
  // Detect non-indicator bonus features available for this property
  const bonusFeatures: string[] = [];
  if (raw.ai_summary) bonusFeatures.push('ai_insights');
  const rawPropCheck = raw.property ?? {};
  if (rawPropCheck.capital_value) bonusFeatures.push('council_valuation');
  bonusFeatures.push('national_earthquake', 'national_climate', 'national_wind');
  const coverage: CoverageInfo | undefined = rawCoverage
    ? {
        available: rawCoverage.available ?? 0,
        total: rawCoverage.total ?? 0,
        percentage: rawCoverage.total
          ? Math.round((rawCoverage.available / rawCoverage.total) * 100)
          : 0,
        per_category: rawCoverage.per_category ?? {},
        bonus_features: bonusFeatures,
      }
    : undefined;

  // Map property fields (backend uses different names)
  const rawProp = raw.property ?? {};
  const property = {
    building_area_sqm: rawProp.footprint_sqm ?? null,
    land_area_sqm: rawProp.cv_land_area || null,
    capital_value: rawProp.capital_value ?? null,
    land_value: rawProp.land_value ?? null,
    improvement_value: rawProp.improvements_value ?? null,
    title_ref: rawProp.title_no ?? null,
    cv_valuation_id: rawProp.cv_valuation_id ?? null,
    cv_address: rawProp.cv_address ?? null,
    cv_is_per_unit: rawProp.cv_is_per_unit ?? false,
    title_type: rawProp.title_type ?? null,
    estate_description: rawProp.estate_description ?? null,
  };

  // Map address (backend has ta_name, frontend expects ta)
  const rawAddr = raw.address ?? {};
  const address = {
    address_id: rawAddr.address_id,
    full_address: rawAddr.full_address ?? '',
    suburb: rawAddr.suburb ?? rawAddr.suburb_locality ?? '',
    city: rawAddr.city ?? rawAddr.town_city ?? '',
    ta: rawAddr.ta_name ?? rawAddr.ta ?? '',
    sa2_code: rawAddr.sa2_code ?? '',
    sa2_name: rawAddr.sa2_name ?? '',
    lng: rawAddr.lng ?? 0,
    lat: rawAddr.lat ?? 0,
  };

  const overall = typeof scores.composite === 'number' ? scores.composite : NaN;
  const ratingBin = toRatingBin(overall);

  const hazards = transformHazards(raw.hazards);
  const planning = transformPlanning(raw.planning, raw.liveability, raw.environment ?? raw.hazards);
  // Mirror contamination_count onto hazards so legacy readers see a consistent number.
  // Source of truth is planning.contamination_count (fed from raw.planning.contam_count_500m).
  if (hazards.contamination_count == null && planning.contamination_count != null) {
    hazards.contamination_count = planning.contamination_count;
  }
  return {
    address,
    property,
    hazards,
    environment: transformEnvironment(raw.environment ?? raw.hazards, raw.hazards),
    liveability: transformLiveability(raw.liveability),
    planning,
    market: transformMarket(raw.market),
    comparisons: transformComparisons(raw.comparisons),
    scores: {
      overall,
      rating: ratingBin,
      categories: buildCategories(rawCategories, rawIndicators),
      percentile: scores.percentile ?? null,
    },
    ai_summary: raw.ai_summary ?? null,
    area_profile: raw.area_profile ?? null,
    property_detection: raw.property_detection ?? null,
    coverage,
    terrain: raw.terrain ?? undefined,
    walking_reach: raw.walking_reach ?? undefined,
  };
}
