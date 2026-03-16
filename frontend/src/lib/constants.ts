// lib/constants.ts — all frontend constants

import type { RatingBin } from './types';

// --- Rating bins (score -> label + color) ---
export const RATING_BINS = [
  { min: 0, max: 20, rating: 'very-low' as const, label: 'Very Low', color: '#22C55E' },
  { min: 21, max: 40, rating: 'low' as const, label: 'Low', color: '#84CC16' },
  { min: 41, max: 60, rating: 'moderate' as const, label: 'Moderate', color: '#EAB308' },
  { min: 61, max: 80, rating: 'high' as const, label: 'High', color: '#F97316' },
  { min: 81, max: 100, rating: 'very-high' as const, label: 'Very High', color: '#EF4444' },
] as const;

export function getRatingBin(score: number) {
  return RATING_BINS.find(b => score >= b.min && score <= b.max) ?? RATING_BINS[2];
}

export function getRatingColor(rating: RatingBin): string {
  const bin = RATING_BINS.find(b => b.rating === rating);
  return bin?.color ?? '#E69F00';
}

// --- Category metadata ---
export const CATEGORIES = [
  { name: 'risk', label: 'Risk & Hazards', icon: 'ShieldAlert', iconColor: 'text-risk-very-high' },
  { name: 'liveability', label: 'Neighbourhood', icon: 'TreePine', iconColor: 'text-piq-success' },
  { name: 'market', label: 'Market & Rental', icon: 'TrendingUp', iconColor: 'text-piq-primary' },
  { name: 'transport', label: 'Transport & Access', icon: 'TrainFront', iconColor: 'text-piq-primary' },
  { name: 'planning', label: 'Planning & Development', icon: 'Landmark', iconColor: 'text-piq-primary' },
] as const;

// --- Map layer configuration ---
export const TILE_LAYERS = [
  // Hazards — most important for property buyers
  { id: 'flood_zones', group: 'Hazards', label: 'Flood Zones', minzoom: 8 },
  { id: 'liquefaction_zones', group: 'Hazards', label: 'Liquefaction', minzoom: 10 },
  { id: 'slope_failure_zones', group: 'Hazards', label: 'Slope Failure', minzoom: 10 },
  { id: 'tsunami_zones', group: 'Hazards', label: 'Tsunami Zones', minzoom: 8 },
  { id: 'coastal_erosion', group: 'Hazards', label: 'Coastal Erosion', minzoom: 8 },
  { id: 'wind_zones', group: 'Hazards', label: 'Wind Zones', minzoom: 8 },
  // Property — users want to see their parcel/building
  { id: 'parcels', group: 'Property', label: 'Parcels', minzoom: 15 },
  { id: 'building_outlines', group: 'Property', label: 'Buildings', minzoom: 13 },
  // Schools — key for families
  { id: 'school_zones', group: 'Schools', label: 'School Zones', minzoom: 10 },
  // Planning — due diligence
  { id: 'district_plan_zones', group: 'Planning', label: 'District Zones', minzoom: 10 },
  { id: 'contaminated_land', group: 'Planning', label: 'Contamination', minzoom: 12 },
  { id: 'heritage_sites', group: 'Planning', label: 'Heritage', minzoom: 12 },
  { id: 'infrastructure_projects', group: 'Planning', label: 'Infrastructure', minzoom: 10 },
  { id: 'transmission_lines', group: 'Planning', label: 'Transmission Lines', minzoom: 8 },
  // Transport
  { id: 'transit_stops', group: 'Transport', label: 'Transit Stops', minzoom: 12 },
  { id: 'crashes', group: 'Transport', label: 'Crashes', minzoom: 13 },
  // Context
  { id: 'noise_contours', group: 'Context', label: 'Noise', minzoom: 11 },
  { id: 'conservation_land', group: 'Context', label: 'Conservation', minzoom: 10 },
  { id: 'osm_amenities', group: 'Context', label: 'Amenities', minzoom: 13 },
  { id: 'sa2_boundaries', group: 'Context', label: 'SA2 Areas', minzoom: 8 },
] as const;

// --- Chart theme ---
export const CHART_THEME = {
  colors: {
    primary: '#0D7377',
    primaryLight: '#B2DFDB',
    accentWarm: '#D4863B',
    grid: '#E5E7EB',
    gridDark: '#374151',
  },
  font: { family: 'Inter, sans-serif', size: 12 },
  axis: { tickLine: false, axisLine: false, tick: { fill: '#6B7280', fontSize: 12 } },
  tooltip: {
    contentStyle: {
      borderRadius: '12px',
      border: '1px solid #E5E7EB',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      fontFamily: 'Inter, sans-serif',
      fontSize: '13px',
    },
  },
  animation: { duration: 800, easing: 'ease-out' as const },
} as const;

// --- Map layer defaults ---
export const DEFAULT_LAYERS: Record<string, boolean> = { building_outlines: true, flood_zones: true, parcels: true };
export const PROPERTY_CONTEXT_LAYERS: Record<string, boolean> = { building_outlines: true, flood_zones: true, parcels: true };
export const MAX_ACTIVE_LAYERS = 5;

// --- Misc ---
export const MAX_RECENT_SEARCHES = 10;
export const MAX_SAVED_PROPERTIES = 20;
export const COVERAGE_TOTAL = 28;
export const LINZ_KEY = process.env.NEXT_PUBLIC_LINZ_API_KEY ?? '';

// Wellington default center
export const DEFAULT_CENTER = { longitude: 174.776, latitude: -41.290, zoom: 14 };
