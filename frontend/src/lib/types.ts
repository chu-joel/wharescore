// lib/types.ts — frontend type definitions (mirrors backend schemas/)

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
  building_area_sqm: number | null;
  land_area_sqm: number | null;
  capital_value: number | null;
  land_value: number | null;
  improvement_value: number | null;
  title_ref: string | null;
  cv_valuation_id: string | null;
  cv_address: string | null;
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
  coastal_erosion: string | null;
  wildfire_risk: string | null;
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
}

// --- Environment ---
export interface EnvironmentData {
  wind_zone: string | null;
  noise_db: number | null;
  air_quality_trend: string | null;
  water_quality_grade: string | null;
  climate_projection: Record<string, unknown> | null;
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
  // Metlink mode breakdown
  bus_stops_800m: number | null;
  rail_stops_800m: number | null;
  ferry_stops_800m: number | null;
  cable_car_stops_800m: number | null;
  // Transit travel times
  transit_travel_times: TransitTravelTime[] | null;
  peak_trips_per_hour: number | null;
  nearest_stop_name: string | null;
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
  height_limit: number | null;
  heritage_count: number | null;
  consent_count: number | null;
  infrastructure_count: number | null;
  contamination_count: number | null;
  epb_listed: boolean | null;
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
export interface CoverageInfo {
  available: number;
  total: number;
  percentage: number;
  per_category: Record<string, number>;
}

// --- Suburb ---
export interface SuburbSearchResult {
  sa2_code: string;
  sa2_name: string;
  ta_name: string;
}

export interface SuburbSummary {
  sa2_code: string;
  sa2_name: string;
  ta_name: string;
  area_hectares: number | null;
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
