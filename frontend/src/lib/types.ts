// lib/types.ts. frontend type definitions (mirrors backend schemas/)

// --- Search ---
export interface SearchResult {
  address_id: number;
  full_address: string;
  suburb: string;
  city: string;
  lng: number;
  lat: number;
}
export interface SearchResponse {
  results: SearchResult[];
  count: number;
}

// --- Property Report ---
export interface PropertyReport {
  address: AddressInfo;
  property: PropertyInfo;
  hazards: HazardData;
  environment: EnvironmentData;
  liveability: LiveabilityData;
  planning: PlanningData;
  market: MarketData;
  scores: CompositeScore;
  comparisons?: ComparisonData;
  ai_summary: string | null;
  area_profile: string | null;
  property_detection: PropertyDetection | null;
  coverage?: CoverageInfo;
  terrain?: {
    elevation_m: number | null;
    slope_degrees: number | null;
    slope_category: string;
    aspect_label: string;
    terrain_source: string;
    landslide_risk?: {
      slope_risk: string;
      slope_risk_score: number | null;
    };
    is_depression: boolean | null;
    depression_depth_m: number | null;
    relative_position: string;
    wind_exposure: string;
    wind_exposure_score: number | null;
    flood_terrain_risk: string;
    flood_terrain_score: number | null;
    nearest_waterway_m: number | null;
    nearest_waterway_name: string | null;
    nearest_waterway_type: string | null;
    waterways_within_500m: number;
  };
  walking_reach?: {
    minutes: number;
    method: string;
    total_stops: number;
    bus_stops: number;
    rail_stops: number;
    ferry_stops: number;
  };
  event_history?: {
    extreme_weather_5yr: number;
    heavy_rain_events: number;
    extreme_wind_events: number;
    worst_rain_mm: number | null;
    worst_wind_kmh: number | null;
    earthquakes_30km_10yr: number;
    largest_quake_magnitude: number | null;
    top_events: Array<{
      type: string;
      date: string;
      title: string;
      severity: string;
      detail: string | null;
      distance_km: number | null;
    }>;
  };
  /** Persona-ranked top findings from the backend badge-finding selector.
   *  Single source of truth shared with the browser extension. KeyFindings
   *  prefers these over generateFindings() for the free-tier visible slice. */
  ranked_findings?: {
    // source is optional. older cached/snapshotted findings won't have it,
    // and only a subset of backend Insight() call sites have been annotated
    // so far (see SOURCE_CATALOG in backend/app/services/report_html.py).
    renter: Array<{ severity: string; title: string; detail: string; source?: { authority: string; url: string } }>;
    buyer: Array<{ severity: string; title: string; detail: string; source?: { authority: string; url: string } }>;
    generic: Array<{ severity: string; title: string; detail: string; source?: { authority: string; url: string } }>;
  };
}

export interface AddressInfo {
  address_id: number;
  full_address: string;
  suburb: string;
  city: string;
  ta: string;
  sa2_code: string;
  sa2_name: string;
  lng: number;
  lat: number;
}

export interface PropertyInfo {
  /** LINZ building_outlines polygon area. For cross-lease / semi-detached /
   * duplex addresses this is the whole structure's footprint and is shared
   * across every unit under that polygon - not a per-unit figure. */
  building_area_sqm: number | null;
  /** Per-unit valued floor area from the council rates API (AKCC / WDC / ICC
   * today). Prefer this over `building_area_sqm` when present. */
  floor_area_sqm?: number | null;
  /** Source tag for floor_area_sqm (e.g. 'akcc', 'wdc_arcgis', 'icc_arcgis'). */
  floor_area_source?: string | null;
  /** Per-unit building site coverage in m² (Auckland only). */
  site_coverage_sqm?: number | null;
  land_area_sqm: number | null;
  capital_value: number | null;
  land_value: number | null;
  improvement_value: number | null;
  title_ref: string | null;
  cv_valuation_id: string | null;
  cv_address: string | null;
  cv_is_per_unit?: boolean;
  title_type: string | null;
  estate_description: string | null;
}

// --- Scores ---
export interface CompositeScore {
  overall: number;
  rating: RatingBin;
  categories: CategoryScore[];
  percentile: number | null;
}

export interface CategoryScore {
  name: 'risk' | 'liveability' | 'market' | 'transport' | 'planning';
  score: number;
  rating: RatingBin;
  indicators: IndicatorScore[];
}

export interface IndicatorScore {
  name: string;
  score: number;
  rating: RatingBin;
  value: string;
  source: string;
  updated: string;
  is_available: boolean;
}

export type RatingBin = 'very-low' | 'low' | 'moderate' | 'high' | 'very-high';

// --- Property Summary (lightweight, for map-tap popup) ---
export interface PropertySummary {
  address_id: number;
  full_address: string;
  suburb: string;
  city: string;
  sa2_name: string | null;
  unit_type: string | null;
  scores: { composite: number; rating: string } | null;
  median_rent: number | null;
  notable_findings: string[];
  unit_count: number | null;
  is_multi_unit: boolean;
}

// --- Market ---
export interface MarketData {
  rent_assessment: RentAssessment | null;
  trend: TrendData | null;
  market_heat: 'cold' | 'cool' | 'neutral' | 'warm' | 'hot';
}

export interface RentAssessment {
  median: number;
  lower_quartile: number;
  upper_quartile: number;
  bond_count: number;
  dwelling_type: string;
  bedrooms: string;
  confidence_stars: 1 | 2 | 3 | 4 | 5;
  user_percentile: number | null;
  is_outlier: boolean;
}

export interface TrendData {
  cagr_1yr: number | null;
  cagr_5yr: number | null;
  cagr_10yr: number | null;
}

// --- Property Detection ---
export interface PropertyDetection {
  detected_type: 'house' | 'flat' | 'apartment' | 'room' | null;
  detected_bedrooms: number | null;
  unit_type: string | null;
  unit_value: string | null;
  is_multi_unit: boolean;
  unit_count: number | null;
  base_address: string | null;
  sibling_valuations: SiblingValuation[] | null;
}

export interface SiblingValuation {
  address: string;
  capital_value: number;
  land_value: number;
  valuation_id: string;
}

// --- Nearby (GeoJSON) ---
export interface NearbyFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: number[] };
  properties: Record<string, unknown>;
}

export interface NearbyResponse {
  type: 'FeatureCollection';
  features: NearbyFeature[];
  count: number;
}

// --- Hazards ---
export interface HazardData {
  flood_zone: string | null;
  tsunami_zone: string | null;
  liquefaction_zone: string | null;
  fault_distance_m: number | null;
  earthquake_count: number | null;
  earthquake_max_mag: number | null;
  coastal_erosion: string | null;
  wildfire_risk: string | null;
  wildfire_vhe_days: number | null;
  epb_count: number | null;
  slope_failure: string | null;
  contamination_count: number | null;
  // Wellington-specific
  earthquake_hazard_index: number | null;
  earthquake_hazard_grade: number | null;
  ground_shaking_zone: string | null;
  ground_shaking_severity: string | null;
  gwrc_liquefaction: string | null;
  gwrc_liquefaction_geology: string | null;
  gwrc_slope_severity: string | null;
  fault_zone_name: string | null;
  fault_zone_ranking: string | null;
  wcc_flood_type: string | null;
  wcc_flood_ranking: string | null;
  wcc_tsunami_return_period: string | null;
  wcc_tsunami_ranking: string | null;
  // Council-specific regional hazard data (all cities)
  council_liquefaction: string | null;
  council_liquefaction_geology: string | null;
  council_liquefaction_source: string | null;
  council_tsunami_ranking: string | null;
  council_tsunami_scenario: string | null;
  council_tsunami_return_period: string | null;
  council_tsunami_source: string | null;
  council_slope_severity: string | null;
  council_slope_source: string | null;
  epb_rating: string | null;
  epb_construction_type: string | null;
  epb_deadline: string | null;
  solar_mean_kwh: number | null;
  solar_max_kwh: number | null;
  // GNS Landslide Database
  landslide_count_500m: number | null;
  landslide_nearest: {
    name: string;
    trigger: string;
    severity: string;
    movement_type: string;
    date: string | null;
    damage: string | null;
    distance_m: number;
  } | null;
  landslide_in_area: boolean | null;
  // GNS Active Faults (national)
  active_fault_nearest: {
    name: string;
    type?: string | null;
    class?: string | null;
    fault_type?: string | null;
    slip_rate_mm_yr: number | null;
    recurrence_interval?: string | null;
    distance_m: number;
  } | null;
  fault_avoidance_zone: {
    fault_name: string;
    zone_type: string;
    fault_class: string;
    setback_m: number;
  } | null;
  // Landslide susceptibility (council data)
  landslide_susceptibility_rating: string | null;
  landslide_susceptibility_type: string | null;
  // Overland flow path
  on_overland_flow_path: boolean | null;
  overland_flow_within_50m: boolean | null;
  // Coastal erosion (council data)
  coastal_erosion_exposure: string | null;
  coastal_erosion_timeframe: number | null;
  council_coastal_erosion: {
    name: string;
    timeframe: number | null;
    scenario: string | null;
    sea_level_rise: number | null;
    distance_m: number | null;
  } | null;
  // Aircraft noise
  aircraft_noise_name: string | null;
  aircraft_noise_dba: number | null;
  aircraft_noise_category: string | null;
  // Coastal elevation
  coastal_elevation_cm: number | null;
  // Flood extent (AEP-based)
  flood_extent_aep: string | null;
  flood_extent_label: string | null;
  // Distance to nearest flood polygon in metres (flood_zones + flood_hazard +
  // flood_extent, within 500m). 0 when inside a polygon, null when none within 500m.
  flood_nearest_m: number | null;
  // Geotechnical reports
  geotech_count_500m: number | null;
  geotech_nearest_hazard: string | null;
  // Coastal inundation (council data)
  coastal_inundation_ranking: string | null;
  coastal_inundation_scenario: string | null;
  // Erosion prone land
  on_erosion_prone_land: boolean | null;
  erosion_min_angle: number | null;
}

// --- Environment ---
export interface EnvironmentData {
  wind_zone: string | null;
  noise_db: number | null;
  air_quality_trend: string | null;
  air_quality_site: string | null;
  air_quality_distance_m: number | null;
  water_quality_grade: string | null;
  water_site_name: string | null;
  water_ecoli_band: string | null;
  water_ammonia_band: string | null;
  water_clarity_band: string | null;
  water_nitrate_band: string | null;
  in_corrosion_zone: boolean | null;
  in_rail_vibration_area: boolean | null;
  rail_vibration_type: string | null;
  climate_temp_change: number | null;
  climate_precip_change_pct: number | null;
}

// --- Liveability ---
export interface LiveabilityData {
  nzdep_score: number | null;
  crime_rate: number | null;
  crime_victimisations: number | null;
  crime_city_median: number | null;
  school_count: number | null;
  transit_count: number | null;
  amenity_count: number | null;
  cbd_distance_m: number | null;
  nearest_train_m: number | null;
  nearest_train_name: string | null;
  // Metlink mode breakdown
  bus_stops_800m: number | null;
  rail_stops_800m: number | null;
  ferry_stops_800m: number | null;
  cable_car_stops_800m: number | null;
  // Transit travel times
  transit_travel_times: TransitTravelTime[] | null;
  transit_travel_times_pm: TransitTravelTime[] | null;
  peak_trips_per_hour: number | null;
  nearest_stop_name: string | null;
  // Walking reach (10-min walk via Valhalla)
  walking_reach_10min: number | null;
  walking_reach_method: string | null;
  // Nearest essentials (OSM amenities; SQL returns {name, distance_m, latitude, longitude})
  nearest_gp: { name: string; distance_m: number } | null;
  nearest_pharmacy: { name: string; distance_m: number } | null;
}

export interface TransitTravelTime {
  destination: string;
  minutes: number;
  routes: string[];
}

// --- Planning ---
export interface PlanningData {
  zone_name: string | null;
  zone_code: string | null;
  zone_category: string | null;
  height_limit: number | null;
  heritage_count: number | null;
  consent_count: number | null;
  infrastructure_count: number | null;
  contamination_count: number | null;
  epb_listed: boolean | null;
  // Viewshafts
  in_viewshaft: boolean | null;
  viewshaft_name: string | null;
  viewshaft_significance: string | null;
  // Character precincts
  in_character_precinct: boolean | null;
  character_precinct_name: string | null;
  // Heritage overlay (Auckland etc.)
  in_heritage_overlay: boolean | null;
  heritage_overlay_name: string | null;
  heritage_overlay_type: string | null;
  // Special character area
  in_special_character_area: boolean | null;
  special_character_name: string | null;
  // Notable trees
  notable_tree_count_50m: number | null;
  notable_tree_nearest: string | null;
  // Significant ecological area
  in_ecological_area: boolean | null;
  ecological_area_name: string | null;
  ecological_area_type: string | null;
  // Mana whenua
  in_mana_whenua: boolean | null;
  mana_whenua_name: string | null;
  // Height variation
  height_variation_limit: string | null;
  // Parks
  park_count_500m: number | null;
  nearest_park_name: string | null;
  nearest_park_distance_m: number | null;
}

// --- Comparisons (suburb + city averages) ---
export interface ComparisonAverages {
  label: string;
  avg_nzdep: number | null;
  school_count_1500m: number | null;
  transit_count_400m: number | null;
  max_noise_db: number | null;
  epb_count_300m: number | null;
}

export interface ComparisonData {
  suburb: ComparisonAverages | null;
  city: ComparisonAverages | null;
}

// --- Coverage ---
export interface CategoryCoverage {
  available: number;
  total: number;
  indicators: string[];
}

export interface CoverageInfo {
  available: number;
  total: number;
  percentage: number;
  per_category: Record<string, CategoryCoverage>;
  bonus_features: string[];
}

// --- Suburb ---
export interface SuburbSearchResult {
  sa2_code: string;
  sa2_name: string;
  ta_name: string;
  lng: number;
  lat: number;
}

export interface SuburbSummary {
  sa2_code: string;
  sa2_name: string;
  ta_name: string;
  area_hectares: number | null;
  lat: number | null;
  lng: number | null;
  property_count: number;
  comparisons: ComparisonAverages | null;
  city_averages: ComparisonAverages | null;
  rental_overview: SuburbRental[];
  rental_trends: SuburbRentalTrend[];
  crime: { ta_name: string; total_offences: number; offence_rate_per_10k: number } | null;
  area_profile: string | null;
}

export interface SuburbRental {
  dwelling_type: string;
  bedrooms: string;
  median_rent: number;
  bond_count: number;
  lower_quartile: number;
  upper_quartile: number;
}

export interface SuburbRentalTrend {
  dwelling_type: string;
  bedrooms: string;
  cagr_1yr: number | null;
  cagr_5yr: number | null;
  cagr_10yr: number | null;
}

// --- Rent Advisor ---
export interface RentAdjustment {
  factor: string;
  label: string;
  pct_low: number;
  pct_high: number;
  dollar_low: number;
  dollar_high: number;
  reason: string;
  category: 'property' | 'hazard' | 'location';
  prevalence_pct?: number;
}

export interface RentAreaContext {
  factor: string;
  label: string;
  value: number;
  city_avg: number | null;
  max_scale: number;
  direction: 'up' | 'down' | 'neutral';
  description: string;
  is_area_wide_hazard?: boolean;
}

export interface RentAdvisorResult {
  verdict: 'below-market' | 'fair' | 'slightly-high' | 'high' | 'very-high';
  band_low: number;
  band_high: number;
  band_low_outer: number;
  band_high_outer: number;
  raw_median: number;
  your_rent: number;
  difference_pct: number;
  adjustments: RentAdjustment[];
  area_context: RentAreaContext[];
  factors_analysed: number;
  factors_available: number;
  advice_lines: string[];
  confidence: 1 | 2 | 3 | 4 | 5;
  bond_count: number;
  data_source: string;
  sa2_name: string;
  disclaimer: string;
}

// --- Price Advisor ---
export interface PriceMethodologyStep {
  step: number;
  label: string;
  value: number;
  detail: string;
}

export interface PriceAdjustment {
  factor: string;
  label: string;
  pct_low: number;
  pct_high: number;
  dollar_low: number;
  dollar_high: number;
  reason: string;
  category: 'property';
}

export interface HazardCostFlag {
  hazard: string;
  label: string;
  insurance_uplift_pct_low: number;
  insurance_uplift_pct_high: number;
  description: string;
  action: string;
  strengthening_cost_low?: number;
  strengthening_cost_high?: number;
}

export interface OwnershipCosts {
  rates_annual: number | null;
  insurance_annual_low: number;
  insurance_annual_high: number;
  insurance_base: number;
  insurance_hazard_uplift_pct: [number, number];
  body_corp_annual: number | null;
}

export interface PriceAdvisorResult {
  estimated_value: number;
  band_low: number;
  band_high: number;
  band_low_outer: number;
  band_high_outer: number;
  cv: number | null;
  cv_date: string | null;
  cv_age_months: number | null;
  hpi_adjusted: number | null;
  yield_inversion: number | null;
  method: 'ensemble' | 'hpi_only' | 'yield_only' | 'cv_only' | null;
  methods_agree_pct: number | null;
  methodology_steps: PriceMethodologyStep[];
  adjustments: PriceAdjustment[];
  hazard_cost_flags: HazardCostFlag[];
  hazard_count: number;
  ownership_costs: OwnershipCosts;
  asking_price: number | null;
  asking_verdict: 'well-below' | 'below' | 'fair' | 'above' | 'well-above' | null;
  asking_diff_pct: number | null;
  area_context: RentAreaContext[];
  factors_analysed: number;
  confidence: 1 | 2 | 3 | 4 | 5;
  bond_count: number;
  sa2_name: string;
  ta_name: string;
  is_multi_unit: boolean;
  disclaimer: string;
}

// --- Report Snapshot (hosted interactive report) ---
export interface RentBaseline {
  raw_median: number;
  bond_count: number;
  data_source: string;
  band_low: number;
  band_high: number;
  band_low_outer: number;
  band_high_outer: number;
  adjustments: RentAdjustment[];
  area_context: RentAreaContext[];
}

export interface DeltaEntry {
  pct_low: number;
  pct_high: number;
}

export interface DeltaTables {
  finish_deltas: Record<string, DeltaEntry>;
  bathroom_deltas: Record<string, DeltaEntry>;
  toggle_deltas: Record<string, DeltaEntry>;
}

export interface SnapshotMeta {
  schema_version: number;
  generated_at: string;
  address_id: number;
  full_address: string;
  persona: 'buyer' | 'renter';
  dwelling_type: string;
  inputs_at_purchase: Record<string, unknown> | null;
  sa2_name: string;
  ta_name: string;
}

export interface ReportSnapshot {
  report: Record<string, unknown>;
  rent_baselines: Record<string, RentBaseline>;
  price_advisor: PriceAdvisorResult | null;
  deltas: DeltaTables;
  recommendations: Array<Record<string, unknown>>;
  insights: Record<string, unknown>;
  ai_insights: Record<string, unknown> | null;
  lifestyle_personas: Array<Record<string, unknown>>;
  lifestyle_tips: string[];
  rent_history: Array<Record<string, unknown>>;
  hpi_data: Array<Record<string, unknown>>;
  crime_trend: Array<{ month: string; count: number }>;
  nearby_highlights: { good: Array<Record<string, unknown>>; caution: Array<Record<string, unknown>>; info: Array<Record<string, unknown>> };
  nearby_supermarkets: Array<Record<string, unknown>>;
  rates_data: Record<string, unknown> | null;
  nearby_doc?: { huts: Array<Record<string, unknown>>; tracks: Array<Record<string, unknown>>; campsites: Array<Record<string, unknown>> };
  school_zones?: Array<{ school_name: string; school_id: number; institution_type: string }>;
  road_noise?: { laeq24h: number } | null;
  weather_history?: Array<{
    date: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    precipitation_mm: number | null;
    wind_gust_kmh: number | null;
    distance_km: number | null;
  }>;
  hazard_advice?: Array<{
    hazard: string;
    severity: string;
    title: string;
    actions: string[];
    source: string;
  }>;
  terrain?: {
    elevation_m: number | null;
    slope_degrees: number | null;
    slope_category: string;
    aspect_degrees: number | null;
    aspect_label: string;
    terrain_source: string;
    landslide_risk?: {
      slope_risk: string;
      slope_risk_score: number | null;
      slope_risk_detail: string | null;
    };
    is_depression: boolean | null;
    depression_depth_m: number | null;
    relative_position: string;
    wind_exposure: string;
    wind_exposure_score: number | null;
    flood_terrain_risk: string;
    flood_terrain_score: number | null;
    nearest_waterway_m: number | null;
    nearest_waterway_name: string | null;
    nearest_waterway_type: string | null;
    waterways_within_500m: number;
  };
  isochrone?: {
    transit_stops_walk_10min: number;
    bus_stops_walk_10min: number;
    rail_stops_walk_10min: number;
    ferry_stops_walk_10min: number;
    isochrone_method: string;
    isochrone_geojson: Record<string, unknown> | null;
  };
  terrain_insights?: Array<{
    severity: 'critical' | 'warning' | 'info' | 'positive';
    title: string;
    detail: string;
    action: string;
    category: string;
  }>;
  census_demographics?: {
    sa2_code: string;
    sa2_name: string;
    population_2018: number | null;
    population_2023: number | null;
    age_under_15: number | null;
    age_15_to_29: number | null;
    age_30_to_64: number | null;
    age_65_plus: number | null;
    median_age: number | null;
    ethnicity_european: number | null;
    ethnicity_maori: number | null;
    ethnicity_pacific: number | null;
    ethnicity_asian: number | null;
    ethnicity_melaa: number | null;
    ethnicity_other: number | null;
    ethnicity_total: number | null;
    born_nz: number | null;
    born_overseas: number | null;
    gender_male: number | null;
    gender_female: number | null;
  } | null;
  census_households?: {
    sa2_code: string;
    sa2_name: string;
    households_2023: number | null;
    hh_one_family: number | null;
    hh_multi_family: number | null;
    hh_one_person: number | null;
    hh_total: number | null;
    hh_crowded: number | null;
    tenure_owned: number | null;
    tenure_not_owned: number | null;
    tenure_family_trust: number | null;
    tenure_total: number | null;
    income_median: number | null;
    income_under_20k: number | null;
    income_20k_30k: number | null;
    income_30k_50k: number | null;
    income_50k_70k: number | null;
    income_70k_100k: number | null;
    income_100k_150k: number | null;
    income_150k_200k: number | null;
    income_200k_plus: number | null;
    vehicles_none: number | null;
    vehicles_total: number | null;
    internet_access: number | null;
    internet_total: number | null;
    rent_median: number | null;
    landlord_private: number | null;
    landlord_kainga_ora: number | null;
    landlord_total: number | null;
  } | null;
  census_commute?: {
    sa2_code: string;
    work_at_home: number | null;
    drive_private: number | null;
    drive_company: number | null;
    passenger: number | null;
    public_bus: number | null;
    train: number | null;
    bicycle: number | null;
    walk_or_jog: number | null;
    ferry: number | null;
    total_stated: number | null;
  } | null;
  business_demography?: {
    sa2_code: string;
    employee_count_2019: number | null;
    employee_count_2024: number | null;
    employee_growth_pct: number | null;
    business_count_2019: number | null;
    business_count_2024: number | null;
    business_growth_pct: number | null;
  } | null;
  climate_normals?: Array<{
    location_name: string;
    month: number;
    temp_mean: number | null;
    temp_max: number | null;
    temp_min: number | null;
    precipitation_mm: number | null;
    rain_days: number | null;
    wind_speed_mean: number | null;
  }> | null;
  meta: SnapshotMeta;
  report_tier?: 'quick' | 'full';
  expires_at?: string | null;
}

// --- Feedback ---
export interface FeedbackCreate {
  type: 'bug' | 'feature' | 'general';
  description: string;
  email?: string;
  satisfaction?: 1 | 2 | 3 | 4 | 5;
  importance?: 'low' | 'medium' | 'high' | 'critical';
  page_url?: string;
  context?: string;
  browser_info?: Record<string, unknown>;
  property_address?: string;
}

// --- Email Signup ---
export interface EmailSignupCreate {
  email: string;
  requested_region?: string;
}

// --- Rent Report ---
export interface RentReportCreate {
  address_id: number;
  dwelling_type: 'House' | 'Flat' | 'Apartment' | 'Room';
  bedrooms: '1' | '2' | '3' | '4' | '5+';
  reported_rent: number;
}
