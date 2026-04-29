import type { PropertyReport } from './types';
import type { Persona } from '@/stores/personaStore';
import {
  type CompareValue,
  type DiffStrategy,
  presentNumber,
  presentString,
  negativeKnown,
  unknown,
} from './compareDiff';
import {
  getFloodTier,
  floodTierLabel,
  liquefactionRating,
  isInTsunamiZone,
  isInLandslideRisk,
  hasHighCoastalErosionRisk,
  hasHighWildfireRisk,
} from './hazards';

/** Single source of truth for what's compared, in what order, with which strategy. */

export interface RowDef {
  id: string;
  label: string;
  strategy: DiffStrategy;
  /** Build a CompareValue for one report. Returning unknown() hides the row from
   *  the winner calculation (per tri-state rules). */
  extract: (report: PropertyReport) => CompareValue;
  /** Optional override for the diff-sentence number formatting. */
  formatDelta?: (winner: CompareValue, loser: CompareValue) => string;
  /** Optional tooltip text — explains jargon to users who don't know the term. */
  help?: string;
}

export interface SectionDef {
  id: string;
  title: string;
  rows: RowDef[];
  /** Whether this section auto-opens on desktop for this persona. */
  defaultOpenOn?: Array<Persona | 'desktop'>;
}

const fmtCurrency0 = (n: number) =>
  `$${Math.round(n).toLocaleString('en-NZ')}`;
const fmtCurrencyShort = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
};
const fmtDistanceM = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
const titleCase = (s: string) =>
  s
    .split(/[_\s-]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');

// ── Risk & Hazards ───────────────────────────────────────────────────────

const riskRows: RowDef[] = [
  {
    id: 'flood',
    label: 'Flood exposure',
    strategy: 'lower-better',
    help: 'Whether the property is inside or near a mapped flood zone. Severe = inside a 1%-AEP (1-in-100-year) zone. Nearby = within 100m of one. Insurers consider both relevant.',
    extract: (r) => {
      const tier = getFloodTier(r.hazards);
      const rank: Record<typeof tier, number> = {
        severe: 4,
        moderate: 3,
        low: 2,
        nearby: 1,
        none: 0,
      };
      if (tier === 'none') return negativeKnown('Not in zone');
      const label = floodTierLabel(tier);
      return presentNumber(rank[tier], label);
    },
  },
  {
    id: 'liquefaction',
    label: 'Liquefaction susceptibility',
    strategy: 'lower-better',
    help: 'How likely the ground is to behave like liquid in a major earthquake. High susceptibility means insurers may load premiums and foundations may need reinforcement.',
    extract: (r) => {
      const rating = liquefactionRating(r.hazards);
      const rankMap: Record<string, number> = {
        very_high: 5, high: 4, moderate: 3, low: 2, very_low: 1, none: 0,
      };
      if (rating === 'unknown') return unknown();
      if (rating === 'none') return negativeKnown('Not in zone');
      return presentNumber(rankMap[rating] ?? 0, titleCase(rating));
    },
  },
  {
    id: 'tsunami',
    label: 'Tsunami zone',
    strategy: 'lower-better',
    extract: (r) => {
      if (!isInTsunamiZone(r.hazards)) return negativeKnown('Not in zone');
      const z = r.hazards.tsunami_zone;
      return presentNumber(2, z ? `Zone ${z}` : 'In zone');
    },
  },
  {
    id: 'landslide',
    label: 'Landslide risk',
    strategy: 'lower-better',
    extract: (r) => {
      if (isInLandslideRisk(r.hazards)) {
        const rating = r.hazards.landslide_susceptibility_rating;
        return presentNumber(2, rating || 'Risk present');
      }
      const count = r.hazards.landslide_count_500m ?? 0;
      if (count > 0) return presentNumber(1, `${count} nearby`);
      return negativeKnown('No mapped risk');
    },
  },
  {
    id: 'coastal-erosion',
    label: 'Coastal erosion risk',
    strategy: 'lower-better',
    extract: (r) => {
      if (hasHighCoastalErosionRisk(r.hazards)) return presentNumber(2, 'High risk');
      if (r.hazards.coastal_erosion) return presentNumber(1, titleCase(r.hazards.coastal_erosion));
      return negativeKnown('No mapped risk');
    },
  },
  {
    id: 'wildfire',
    label: 'Wildfire risk',
    strategy: 'lower-better',
    extract: (r) => {
      if (hasHighWildfireRisk(r.hazards)) return presentNumber(2, 'High');
      const days = r.hazards.wildfire_vhe_days ?? 0;
      if (days > 0) return presentNumber(1, `${days} VHE days/yr`);
      return negativeKnown('Low');
    },
  },
  {
    id: 'fault',
    label: 'Nearest active fault',
    strategy: 'higher-better',
    extract: (r) => {
      const f = r.hazards.active_fault_nearest;
      if (!f || f.distance_m == null) return unknown();
      const name = f.name && f.name !== 'null' ? f.name : null;
      const display = name ? `${fmtDistanceM(f.distance_m)} (${name})` : fmtDistanceM(f.distance_m);
      return presentNumber(f.distance_m, display);
    },
    formatDelta: (w, l) => {
      if (w.kind !== 'present' || l.kind !== 'present') return '';
      const diff = (w.value as number) - (l.value as number);
      return `${fmtDistanceM(Math.abs(diff))} farther from a fault`;
    },
  },
  {
    id: 'coastal-elevation',
    label: 'Coastal elevation above sea',
    strategy: 'higher-better',
    extract: (r) => {
      const cm = r.hazards.coastal_elevation_cm;
      if (cm == null) return unknown();
      return presentNumber(cm, `${(cm / 100).toFixed(1)}m`);
    },
    formatDelta: (w, l) => {
      if (w.kind !== 'present' || l.kind !== 'present') return '';
      const diff = ((w.value as number) - (l.value as number)) / 100;
      return `${diff.toFixed(1)}m higher above sea level`;
    },
  },
  {
    id: 'epb',
    label: 'Earthquake-prone buildings nearby',
    strategy: 'lower-better',
    help: 'Buildings within 300m formally listed as earthquake-prone. Higher counts can affect access, evacuation, and aftershock damage in a major event.',
    extract: (r) => {
      const c = r.hazards.epb_count;
      if (c == null) return unknown();
      if (c === 0) return negativeKnown('None within 300m');
      return presentNumber(c, `${c} within 300m`);
    },
  },
  {
    id: 'contamination',
    label: 'Contamination sites',
    strategy: 'lower-better',
    extract: (r) => {
      const c = r.hazards.contamination_count;
      if (c == null) return unknown();
      if (c === 0) return negativeKnown('None mapped');
      return presentNumber(c, `${c} mapped`);
    },
  },
];

// ── Market ────────────────────────────────────────────────────────────────

const marketRows: RowDef[] = [
  {
    id: 'capital-value',
    label: 'Capital value (CV)',
    strategy: 'lower-better',
    extract: (r) => {
      const cv = r.property.capital_value;
      if (cv == null) return unknown();
      return presentNumber(cv, fmtCurrencyShort(cv));
    },
    formatDelta: (w, l) => {
      if (w.kind !== 'present' || l.kind !== 'present') return '';
      const diff = (l.value as number) - (w.value as number);
      return `${fmtCurrencyShort(diff)} cheaper CV`;
    },
  },
  {
    id: 'land-value',
    label: 'Land value',
    strategy: 'identity',
    extract: (r) => {
      const v = r.property.land_value;
      if (v == null) return unknown();
      return presentNumber(v, fmtCurrencyShort(v));
    },
  },
  // Median rent intentionally omitted here — already surfaced on the
  // scoreboard as the renter persona's primary $ metric. Showing it again
  // in this section would just duplicate the same diff.
  {
    id: 'rent-band',
    label: 'Rent range (LQ–UQ)',
    strategy: 'identity',
    help: 'Lower Quartile to Upper Quartile of bond data for similar dwellings in the suburb. Roughly the middle 50% of recent rents.',
    extract: (r) => {
      const ra = r.market.rent_assessment;
      if (!ra || ra.lower_quartile == null || ra.upper_quartile == null) return unknown();
      return presentString(
        `${ra.lower_quartile}-${ra.upper_quartile}`,
        `$${ra.lower_quartile}–$${ra.upper_quartile}/wk`,
      );
    },
  },
  {
    id: 'market-heat',
    label: 'Market heat',
    strategy: 'categorical',
    extract: (r) => {
      const h = r.market.market_heat;
      if (!h) return unknown();
      return presentString(h, titleCase(h));
    },
  },
  {
    id: 'cagr-1yr',
    label: '1-year price growth',
    strategy: 'higher-better',
    help: 'CAGR — compound annual growth rate of the suburb’s house price index over the last 12 months. Suburb-level signal, not property-specific.',
    extract: (r) => {
      const v = r.market.trend?.cagr_1yr;
      if (v == null) return unknown();
      return presentNumber(v, `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
    },
    formatDelta: (w, l) => {
      if (w.kind !== 'present' || l.kind !== 'present') return '';
      const diff = (w.value as number) - (l.value as number);
      return `${diff.toFixed(1) }pp stronger growth`;
    },
  },
];

// ── Liveability / Neighbourhood ──────────────────────────────────────────

const liveabilityRows: RowDef[] = [
  {
    id: 'walking-reach',
    label: '10-min walk reach (stops)',
    strategy: 'higher-better',
    extract: (r) => {
      const v = r.liveability.walking_reach_10min;
      if (v == null) return unknown();
      return presentNumber(v, `${v} stops`);
    },
  },
  {
    id: 'schools',
    label: 'Schools within 1.5km',
    strategy: 'higher-better',
    extract: (r) => {
      const c = r.liveability.school_count;
      if (c == null) return unknown();
      return presentNumber(c, String(c));
    },
  },
  {
    id: 'amenities',
    label: 'Amenities within walk',
    strategy: 'higher-better',
    extract: (r) => {
      const c = r.liveability.amenity_count;
      if (c == null) return unknown();
      return presentNumber(c, String(c));
    },
  },
  {
    id: 'gp-distance',
    label: 'Nearest GP',
    strategy: 'lower-better',
    extract: (r) => {
      const gp = r.liveability.nearest_gp;
      if (!gp || gp.distance_m == null) return unknown();
      return presentNumber(gp.distance_m, fmtDistanceM(gp.distance_m));
    },
    formatDelta: (w, l) => {
      if (w.kind !== 'present' || l.kind !== 'present') return '';
      const diff = (l.value as number) - (w.value as number);
      return `${fmtDistanceM(Math.abs(diff))} closer to a GP`;
    },
  },
  {
    id: 'pharmacy-distance',
    label: 'Nearest pharmacy',
    strategy: 'lower-better',
    extract: (r) => {
      const ph = r.liveability.nearest_pharmacy;
      if (!ph || ph.distance_m == null) return unknown();
      return presentNumber(ph.distance_m, fmtDistanceM(ph.distance_m));
    },
  },
  {
    id: 'noise',
    label: 'Max road/rail noise (dB)',
    strategy: 'lower-better',
    extract: (r) => {
      const db = r.environment.noise_db;
      if (db == null) return unknown();
      return presentNumber(db, `${Math.round(db)} dB`);
    },
  },
  {
    id: 'deprivation',
    label: 'NZDep deprivation index',
    strategy: 'lower-better',
    help: 'NZDep is a 1-10 socioeconomic deprivation score. Decile 1 = least deprived, 10 = most. Lower is better — but on its own NZDep is a coarse signal; treat it as context, not a verdict.',
    extract: (r) => {
      const d = r.liveability.nzdep_score;
      if (d == null) return unknown();
      return presentNumber(d, `Decile ${d}`);
    },
  },
  {
    id: 'parks',
    label: 'Parks within 500m',
    strategy: 'higher-better',
    extract: (r) => {
      const c = r.planning.park_count_500m;
      if (c == null) return unknown();
      return presentNumber(c, String(c));
    },
  },
];

// ── Transport ────────────────────────────────────────────────────────────

const transportRows: RowDef[] = [
  {
    id: 'transit-stops',
    label: 'Transit stops within 400m',
    strategy: 'higher-better',
    extract: (r) => {
      const c = r.liveability.transit_count;
      if (c == null) return unknown();
      return presentNumber(c, String(c));
    },
  },
  {
    id: 'bus-stops',
    label: 'Bus stops within 800m',
    strategy: 'higher-better',
    extract: (r) => {
      const c = r.liveability.bus_stops_800m;
      if (c == null) return unknown();
      return presentNumber(c, String(c));
    },
  },
  {
    id: 'rail-stops',
    label: 'Rail stops within 800m',
    strategy: 'higher-better',
    extract: (r) => {
      const c = r.liveability.rail_stops_800m;
      if (c == null) return unknown();
      if (c === 0) return negativeKnown('None');
      return presentNumber(c, String(c));
    },
  },
  {
    id: 'ferry-stops',
    label: 'Ferry stops within 800m',
    strategy: 'higher-better',
    extract: (r) => {
      const c = r.liveability.ferry_stops_800m;
      if (c == null) return unknown();
      if (c === 0) return negativeKnown('None');
      return presentNumber(c, String(c));
    },
  },
  {
    id: 'peak-trips',
    label: 'Peak trips per hour',
    strategy: 'higher-better',
    extract: (r) => {
      const v = r.liveability.peak_trips_per_hour;
      if (v == null) return unknown();
      return presentNumber(v, `${v}/hr`);
    },
  },
  {
    id: 'cbd-distance',
    label: 'Distance to CBD',
    strategy: 'lower-better',
    extract: (r) => {
      const m = r.liveability.cbd_distance_m;
      if (m == null) return unknown();
      return presentNumber(m, fmtDistanceM(m));
    },
    formatDelta: (w, l) => {
      if (w.kind !== 'present' || l.kind !== 'present') return '';
      return `${fmtDistanceM(Math.abs((l.value as number) - (w.value as number)))} closer to the CBD`;
    },
  },
  {
    id: 'nearest-train',
    label: 'Nearest train station',
    strategy: 'lower-better',
    extract: (r) => {
      const m = r.liveability.nearest_train_m;
      if (m == null) return unknown();
      const name = r.liveability.nearest_train_name;
      return presentNumber(m, name ? `${fmtDistanceM(m)} (${name})` : fmtDistanceM(m));
    },
  },
];

// ── Planning ─────────────────────────────────────────────────────────────

const planningRows: RowDef[] = [
  {
    id: 'zone',
    label: 'Zone',
    strategy: 'categorical',
    extract: (r) => {
      const z = r.planning.zone_name;
      if (!z) return unknown();
      return presentString(z);
    },
  },
  {
    id: 'height-limit',
    label: 'Height limit',
    strategy: 'identity',
    extract: (r) => {
      const h = r.planning.height_limit;
      if (h == null) return unknown();
      return presentNumber(h, `${h}m`);
    },
  },
  {
    id: 'heritage',
    label: 'Heritage listings nearby',
    strategy: 'lower-better',
    extract: (r) => {
      const c = r.planning.heritage_count;
      if (c == null) return unknown();
      if (c === 0) return negativeKnown('None');
      return presentNumber(c, String(c));
    },
  },
  {
    id: 'character-precinct',
    label: 'Character precinct',
    strategy: 'lower-better',
    extract: (r) => {
      if (r.planning.in_character_precinct === null) return unknown();
      if (!r.planning.in_character_precinct) return negativeKnown('Not in precinct');
      return presentNumber(1, r.planning.character_precinct_name || 'In precinct');
    },
  },
  {
    id: 'special-character',
    label: 'Special character area',
    strategy: 'lower-better',
    extract: (r) => {
      if (r.planning.in_special_character_area === null) return unknown();
      if (!r.planning.in_special_character_area) return negativeKnown('Not in area');
      return presentNumber(1, r.planning.special_character_name || 'In area');
    },
  },
  {
    id: 'ecological-area',
    label: 'Significant ecological area',
    strategy: 'lower-better',
    extract: (r) => {
      if (r.planning.in_ecological_area === null) return unknown();
      if (!r.planning.in_ecological_area) return negativeKnown('Not in area');
      return presentNumber(1, r.planning.ecological_area_name || 'In area');
    },
  },
];

// ── Property basics ──────────────────────────────────────────────────────

const propertyRows: RowDef[] = [
  {
    id: 'land-area',
    label: 'Land area',
    strategy: 'higher-better',
    extract: (r) => {
      const v = r.property.land_area_sqm;
      if (v == null) return unknown();
      return presentNumber(v, `${Math.round(v)} m²`);
    },
  },
  {
    id: 'floor-area',
    label: 'Floor area',
    strategy: 'higher-better',
    extract: (r) => {
      // Prefer floor_area_sqm (per-unit from rates API); fall back to building_area_sqm.
      const v = r.property.floor_area_sqm ?? r.property.building_area_sqm;
      if (v == null) return unknown();
      return presentNumber(v, `${Math.round(v)} m²`);
    },
  },
  {
    id: 'title-type',
    label: 'Title type',
    strategy: 'categorical',
    extract: (r) => {
      const t = r.property.title_type;
      if (!t) return unknown();
      return presentString(t);
    },
  },
  {
    id: 'estate',
    label: 'Estate description',
    strategy: 'identity',
    extract: (r) => {
      const e = r.property.estate_description;
      if (!e) return unknown();
      return presentString(e);
    },
  },
];

// ── Crime & Safety ───────────────────────────────────────────────────────

const crimeRows: RowDef[] = [
  {
    id: 'crime-rate',
    label: 'Crime rate (per 10k people)',
    strategy: 'lower-better',
    extract: (r) => {
      const v = r.liveability.crime_rate;
      if (v == null) return unknown();
      return presentNumber(v, v.toFixed(1));
    },
  },
  {
    id: 'crime-vs-city',
    label: 'Vs city median',
    strategy: 'lower-better',
    extract: (r) => {
      const r1 = r.liveability.crime_rate;
      const med = r.liveability.crime_city_median;
      if (r1 == null || med == null || med === 0) return unknown();
      const pct = ((r1 - med) / med) * 100;
      return presentNumber(pct, `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`);
    },
  },
];

// ── Section list (full free-report parity) ──────────────────────────────

export const SECTIONS: SectionDef[] = [
  { id: 'risk',          title: 'Risk & Hazards',     rows: riskRows,         defaultOpenOn: ['buyer', 'desktop'] },
  { id: 'market',        title: 'Market',             rows: marketRows,       defaultOpenOn: ['renter', 'buyer', 'desktop'] },
  { id: 'liveability',   title: 'Liveability',        rows: liveabilityRows,  defaultOpenOn: ['renter'] },
  { id: 'transport',     title: 'Transport',          rows: transportRows,    defaultOpenOn: ['renter'] },
  { id: 'planning',      title: 'Planning & Zoning',  rows: planningRows,     defaultOpenOn: ['buyer'] },
  { id: 'property',      title: 'Property basics',    rows: propertyRows },
  { id: 'crime',         title: 'Crime & Safety',     rows: crimeRows },
];

/** Persona-driven section ordering. */
export function orderedSections(persona: Persona): SectionDef[] {
  if (persona === 'renter') {
    const order = ['market', 'liveability', 'transport', 'risk', 'crime', 'property', 'planning'];
    return order
      .map((id) => SECTIONS.find((s) => s.id === id))
      .filter((s): s is SectionDef => !!s);
  }
  // Buyer: Risk first, Market, then Planning, Liveability, Transport, Property, Crime.
  const order = ['risk', 'market', 'planning', 'liveability', 'transport', 'property', 'crime'];
  return order
    .map((id) => SECTIONS.find((s) => s.id === id))
    .filter((s): s is SectionDef => !!s);
}
