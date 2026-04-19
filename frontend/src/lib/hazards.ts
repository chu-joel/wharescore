import type { HazardData } from './types';

type FloodHazards = Pick<
  HazardData,
  'flood_zone' | 'flood_extent_label' | 'flood_extent_aep' | 'wcc_flood_type' | 'wcc_flood_ranking'
>;

type CoastalErosionHazards = Pick<
  HazardData,
  'coastal_erosion' | 'coastal_erosion_exposure' | 'council_coastal_erosion'
>;

type LandslideHazards = Pick<
  HazardData,
  'landslide_in_area' | 'landslide_susceptibility_rating' | 'landslide_count_500m'
>;

type WildfireHazards = Pick<HazardData, 'wildfire_risk' | 'wildfire_vhe_days'>;

type TsunamiHazards = Pick<
  HazardData,
  'tsunami_zone' | 'wcc_tsunami_ranking' | 'wcc_tsunami_return_period' | 'council_tsunami_ranking'
>;

// Three separate flood fields exist in the report. Any one of them means the
// property is within a mapped flood hazard:
//   flood_zone            — GWRC flood_zones national layer (sparse)
//   flood_extent_*        — regional council flood extents (AEP-based, broad)
//   wcc_flood_type        — WCC District Plan flood hazard overlay
// Treat them all as "in a flood zone" for UI gating and findings.
export function isInFloodZone(h: Partial<FloodHazards> | null | undefined): boolean {
  if (!h) return false;
  return !!(h.flood_zone || h.flood_extent_label || h.flood_extent_aep || h.wcc_flood_type);
}

// Coastal erosion — insurer-relevant when high OR within a mapped council
// erosion overlay. Three sources emit this information and only one is aliased
// into `coastal_erosion`; check all of them.
export function hasHighCoastalErosionRisk(
  h: Partial<CoastalErosionHazards> | null | undefined
): boolean {
  if (!h) return false;
  const nat = String(h.coastal_erosion ?? '').toLowerCase();
  const exposure = String(h.coastal_erosion_exposure ?? '').toLowerCase();
  if (nat.includes('high') || nat.includes('severe')) return true;
  if (exposure.includes('high') || exposure.includes('severe')) return true;
  // council_coastal_erosion presence means the property is within 500m of a
  // mapped council erosion line (Auckland ASCIE + select councils). Insurers
  // treat this as a loadable factor even without an explicit severity label.
  if (h.council_coastal_erosion) return true;
  return false;
}

// Landslide — covers GNS documented events, mapped landslide polygons, and
// council-level susceptibility overlays (GWRC + Auckland).
export function isInLandslideRisk(
  h: Partial<LandslideHazards> | null | undefined
): boolean {
  if (!h) return false;
  if (h.landslide_in_area) return true;
  const susc = String(h.landslide_susceptibility_rating ?? '').toLowerCase();
  if (susc.includes('high') || susc.includes('very')) return true;
  if ((h.landslide_count_500m ?? 0) >= 3) return true;
  return false;
}

// Wildfire — `wildfire_risk` is a trend string ("increasing"/"stable"/etc.)
// not a severity label, so the old `.includes('high')` check effectively never
// fired. Real insurance signal is the Very High/Extreme fire danger day count.
export function hasHighWildfireRisk(
  h: Partial<WildfireHazards> | null | undefined
): boolean {
  if (!h) return false;
  const days = Number(h.wildfire_vhe_days ?? 0);
  if (days >= 15) return true;
  const trend = String(h.wildfire_risk ?? '').toLowerCase();
  if (trend.includes('increasing') && days >= 8) return true;
  return false;
}

// Tsunami — `tsunami_zone` already falls back through national + council +
// WCC in `transformReport.ts`, but expose a helper so call sites can treat
// all tsunami sources uniformly.
export function isInTsunamiZone(
  h: Partial<TsunamiHazards> | null | undefined
): boolean {
  if (!h) return false;
  const zone = String(h.tsunami_zone ?? '').toLowerCase();
  if (zone && zone !== 'none' && zone !== '0') return true;
  if (h.wcc_tsunami_ranking || h.council_tsunami_ranking) return true;
  return false;
}

// Human-readable label for the flood flag. Returns null when no flag is set.
// Preference order matches specificity: explicit zone label → AEP extent label
// → AEP code → WCC overlay type.
export function floodLabel(h: Partial<FloodHazards> | null | undefined): string | null {
  if (!h) return null;
  if (h.flood_zone) return String(h.flood_zone);
  if (h.flood_extent_label) return String(h.flood_extent_label);
  if (h.flood_extent_aep) return `${h.flood_extent_aep} AEP flood extent`;
  if (h.wcc_flood_type) {
    const rank = h.wcc_flood_ranking ? ` — ${h.wcc_flood_ranking} ranking` : '';
    return `${h.wcc_flood_type}${rank}`;
  }
  return null;
}
