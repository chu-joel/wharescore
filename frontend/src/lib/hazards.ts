import type { HazardData } from './types';

type FloodHazards = Pick<
  HazardData,
  'flood_zone' | 'flood_extent_label' | 'flood_extent_aep' | 'wcc_flood_type' | 'wcc_flood_ranking' | 'flood_nearest_m'
>;

// "Close to" threshold in metres. 100m is roughly a street width. close
// enough that a 1% AEP event that overtops the polygon edge could still
// affect the property, and close enough that insurers treat it as relevant.
export const FLOOD_PROXIMITY_THRESHOLD_M = 100;

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

type LiquefactionHazards = Pick<
  HazardData,
  'liquefaction_zone' | 'gwrc_liquefaction' | 'council_liquefaction'
>;

export type LiquefactionRating = 'very_high' | 'high' | 'moderate' | 'low' | 'very_low' | 'none' | 'unknown';

const LIQ_RATING_RANK: Record<LiquefactionRating, number> = {
  very_high: 0, high: 1, moderate: 2, low: 3, very_low: 4, none: 5, unknown: 6,
};

// Councils emit liquefaction susceptibility in wildly different vocabularies:
// standard Very High..Low, Canterbury "damage is possible - High vulnerability",
// Auckland Possible/Unlikely, Marlborough Zone A-F, Christchurch "Category 1",
// Porirua/Invercargill bare "Liquefaction", Southland "Medium", Waimakariri
// "Extremely low to no liquefaction potential", etc. Mirror of Python
// normalize_liquefaction() in backend/app/services/report_html.py. Keep the two
// in sync when adding new vocabularies.
export function normalizeLiquefaction(raw: string | null | undefined): LiquefactionRating {
  if (!raw || !String(raw).trim()) return 'none';
  const s = String(raw).trim().toLowerCase();

  if (s === 'ice' || s === 'water' || s === 'peat subsidence hazard' || s === 'none') return 'none';
  if (s === 'unknown' || s === 'undetermined') return 'unknown';
  if (s.includes('negligible') || s.includes('not applicable')) return 'none';

  if (s.includes('management zone category 1') || s.includes('management zone 1')) return 'high';

  // Marlborough investigation zones — word boundaries to avoid "zone c" inside
  // "zone category".
  if (/\bzone\s+a\b/.test(s)) return 'very_high';
  if (/\bzone\s+b\b/.test(s)) return 'high';
  if (/\bzone\s+[cd]\b/.test(s)) return 'moderate';
  if (/\bzone\s+[ef]\b/.test(s)) return 'low';

  if (s.includes('damage is possible') || s.includes('damage possible')) {
    if (s.includes('high')) return 'high';
    if (s.includes('medium') || s.includes('moderate')) return 'moderate';
    if (s.includes('very low')) return 'low';
    return 'moderate';
  }
  if (s.includes('damage is unlikely') || s.includes('damage unlikely')) {
    return s.includes('very low') ? 'very_low' : 'low';
  }

  if (s.includes('very high')) return 'very_high';
  if (s.includes('very low') || s.includes('extremely low')) return 'very_low';
  if (s.includes('high')) return 'high';
  if (s.includes('moderate') || s.includes('medium')) return 'moderate';
  if (s.includes('low')) return 'low';

  if (s.includes('possible')) return 'moderate';
  if (s.includes('unlikely')) return 'low';

  if (s.includes('liquefaction')) return 'moderate';

  return 'unknown';
}

// Worst rating across all three council liquefaction fields. Different councils
// populate different fields; the old inline checks only looked at
// `liquefaction_zone` which is empty for most of the country (including
// Wellington where `gwrc_liquefaction` is the authoritative field).
export function liquefactionRating(
  h: Partial<LiquefactionHazards> | null | undefined
): LiquefactionRating {
  if (!h) return 'none';
  const ratings: LiquefactionRating[] = [
    normalizeLiquefaction(h.liquefaction_zone),
    normalizeLiquefaction(h.gwrc_liquefaction),
    normalizeLiquefaction(h.council_liquefaction),
  ];
  const known = ratings.filter(r => r !== 'unknown');
  if (known.length === 0) return ratings.some(r => r === 'unknown') ? 'unknown' : 'none';
  return known.reduce((worst, r) => (LIQ_RATING_RANK[r] < LIQ_RATING_RANK[worst] ? r : worst));
}

export function isHighOrVeryHighLiquefaction(h: Partial<LiquefactionHazards> | null | undefined): boolean {
  const r = liquefactionRating(h);
  return r === 'high' || r === 'very_high';
}

export function isModerateOrWorseLiquefaction(h: Partial<LiquefactionHazards> | null | undefined): boolean {
  const r = liquefactionRating(h);
  return r === 'moderate' || r === 'high' || r === 'very_high';
}

// Three separate flood fields exist in the report. Any one of them means the
// property is within a mapped flood hazard:
//   flood_zone           . GWRC flood_zones national layer (sparse)
//   flood_extent_*       . regional council flood extents (AEP-based, broad)
//   wcc_flood_type       . WCC District Plan flood hazard overlay
// Treat them all as "in a flood zone" for UI gating and findings.
export function isInFloodZone(h: Partial<FloodHazards> | null | undefined): boolean {
  if (!h) return false;
  return !!(h.flood_zone || h.flood_extent_label || h.flood_extent_aep || h.wcc_flood_type);
}

// Coastal erosion. insurer-relevant when high OR within a mapped council
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

// Landslide. covers GNS documented events, mapped landslide polygons, and
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

// Wildfire. `wildfire_risk` is a trend string ("increasing"/"stable"/etc.)
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

// Tsunami. `tsunami_zone` already falls back through national + council +
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

// True when the property is close to a flood polygon but NOT inside one.
// Properties inside a polygon are handled by `isInFloodZone`; this covers
// the "one block away" case where the mapped zone boundary is an imprecise
// proxy for real-world flood risk.
export function isNearFloodZone(
  h: Partial<FloodHazards> | null | undefined,
  thresholdM: number = FLOOD_PROXIMITY_THRESHOLD_M,
): boolean {
  if (!h) return false;
  if (isInFloodZone(h)) return false;
  const dist = h.flood_nearest_m;
  if (dist == null) return false;
  return dist > 0 && dist <= thresholdM;
}

// Rounded metres to the nearest flood polygon when `isNearFloodZone` is true.
// Null otherwise. UI uses this for the "within Nm of a flood zone" copy.
export function floodProximityM(
  h: Partial<FloodHazards> | null | undefined,
): number | null {
  if (!isNearFloodZone(h)) return null;
  return Math.round(h!.flood_nearest_m as number);
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
    const rank = h.wcc_flood_ranking ? `. ${h.wcc_flood_ranking} ranking` : '';
    return `${h.wcc_flood_type}${rank}`;
  }
  return null;
}
