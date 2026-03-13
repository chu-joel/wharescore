// lib/transformReport.ts — maps raw API response to frontend PropertyReport type
//
// The backend returns a different shape than the frontend types expect.
// This transform bridges the gap so components get the shape they need.

import type {
  PropertyReport,
  CategoryScore,
  CoverageInfo,
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

// --- Indicator → category mapping ---
const INDICATOR_CATEGORIES: Record<string, string> = {
  flood: 'risk', tsunami: 'risk', liquefaction: 'risk', earthquake: 'risk',
  coastal_erosion: 'risk', wind: 'risk', wildfire: 'risk', epb: 'risk', slope_failure: 'risk',
  noise: 'risk', air_quality: 'risk', water_quality: 'risk',
  climate: 'risk', contaminated_land: 'risk',
  nzdep: 'liveability', schools: 'liveability', school_zone: 'liveability',
  transit: 'transport', crashes: 'transport',
  heritage: 'planning', zone_permissiveness: 'planning',
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

  return Object.entries(merged).map(([name, score]) => ({
    name: name as CategoryScore['name'],
    score,
    rating: toRatingBin(score),
    indicators: (indicatorsByCategory[name] ?? []).map((ind) => ({
      name: ind.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
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
    school_count: Array.isArray(raw.schools_1500m) ? raw.schools_1500m.length : null,
    transit_count: raw.transit_stops_400m ?? null,
    amenity_count: raw.amenities_500m
      ? Object.values(raw.amenities_500m as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
      : null,
    cbd_distance_m: raw.cbd_distance_m ?? null,
    nearest_train_m: raw.nearest_train_distance_m ?? null,
  };
}

function transformPlanning(raw: any, liveabilityRaw: any, environmentRaw: any): PlanningData {
  if (!raw) return {} as PlanningData;
  return {
    zone_name: raw.zone_name ?? null,
    zone_code: raw.zone_code ?? null,
    height_limit: raw.max_height_m ?? null,
    heritage_count: liveabilityRaw?.heritage_count_500m ?? null,
    consent_count: raw.resource_consents_500m_2yr ?? null,
    infrastructure_count: Array.isArray(raw.infrastructure_5km) ? raw.infrastructure_5km.length : null,
    contamination_count: environmentRaw?.contam_count_2km ?? null,
    epb_listed: raw.epb_listed ?? null,
  };
}

function transformHazards(raw: any): HazardData {
  if (!raw) return {} as HazardData;
  return {
    flood_zone: raw.flood ?? null,
    tsunami_zone: raw.tsunami_evac_zone ?? raw.tsunami_zone_class?.toString() ?? null,
    liquefaction_zone: raw.liquefaction ?? null,
    fault_distance_m: null, // not in API
    earthquake_count: raw.earthquake_count_30km ?? null,
    coastal_erosion: raw.coastal_exposure ?? null,
    wildfire_risk: raw.wildfire_trend ?? null,
    epb_count: raw.epb_count_300m ?? null,
    slope_failure: raw.slope_failure ?? null,
    contamination_count: null, // moved to planning
  };
}

function transformEnvironment(raw: any): EnvironmentData {
  if (!raw) return {} as EnvironmentData;
  return {
    wind_zone: null, // wind_zone is in hazards
    noise_db: raw.road_noise_db ?? null,
    air_quality_trend: raw.air_pm10_trend ?? raw.air_pm25_trend ?? null,
    water_quality_grade: raw.water_drp_band ?? null,
    climate_projection: raw.climate_temp_change != null
      ? { temp_change: raw.climate_temp_change, precip_change_pct: raw.climate_precip_change_pct }
      : null,
  };
}

function transformMarket(raw: any): MarketData {
  if (!raw) return {} as MarketData;

  // Build rent_assessment from rental_overview — pick the "ALL" dwelling type, "ALL" beds row
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

  // Build trend from trends array — pick the "ALL"/"ALL" row
  let trend = null;
  if (Array.isArray(raw.trends)) {
    const allTrend = raw.trends.find(
      (t: any) => t.dwelling_type === 'ALL' && t.beds === 'ALL',
    );
    if (allTrend) {
      trend = {
        cagr_1yr: allTrend.yoy_pct ?? null,
        cagr_5yr: allTrend.cagr_5yr ?? null,
        cagr_10yr: allTrend.cagr_10yr ?? null,
      };
    }
  }

  return {
    rent_assessment: rentAssessment,
    trend,
    market_heat: 'neutral',
  };
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
  const coverage: CoverageInfo | undefined = rawCoverage
    ? {
        available: rawCoverage.available ?? 0,
        total: rawCoverage.total ?? 0,
        percentage: rawCoverage.total
          ? Math.round((rawCoverage.available / rawCoverage.total) * 100)
          : 0,
        per_category: {},
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

  return {
    address,
    property,
    hazards: transformHazards(raw.hazards),
    environment: transformEnvironment(raw.environment),
    liveability: transformLiveability(raw.liveability),
    planning: transformPlanning(raw.planning, raw.liveability, raw.environment),
    market: transformMarket(raw.market),
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
  };
}
