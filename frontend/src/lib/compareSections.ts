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
import { getFloodTier, floodTierLabel, liquefactionRating, isInTsunamiZone } from './hazards';

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

// ── Risk & Hazards ───────────────────────────────────────────────────────

const riskRows: RowDef[] = [
  {
    id: 'flood',
    label: 'Flood exposure',
    strategy: 'lower-better',
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
    extract: (r) => {
      const rating = liquefactionRating(r.hazards);
      const rankMap: Record<string, number> = {
        very_high: 5,
        high: 4,
        moderate: 3,
        low: 2,
        very_low: 1,
        none: 0,
      };
      if (rating === 'unknown') return unknown();
      if (rating === 'none') return negativeKnown('Not in zone');
      const display = rating
        .split('_')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ');
      return presentNumber(rankMap[rating] ?? 0, display);
    },
  },
  {
    id: 'tsunami',
    label: 'Tsunami zone',
    strategy: 'lower-better',
    extract: (r) => {
      if (!isInTsunamiZone(r.hazards)) return negativeKnown('Not in zone');
      const z = r.hazards.tsunami_zone;
      // tsunami_zone strings vary; treat any presence as severity 1+ until we
      // have a tier helper analogous to getFloodTier.
      return presentNumber(2, z ? `Zone ${z}` : 'In zone');
    },
  },
  {
    id: 'slope-failure',
    label: 'Slope / landslide rating',
    strategy: 'lower-better',
    extract: (r) => {
      const s = r.hazards.slope_failure;
      if (!s) return negativeKnown('No mapped risk');
      const lower = s.toLowerCase();
      if (lower.includes('very high')) return presentNumber(4, 'Very High');
      if (lower.includes('high')) return presentNumber(3, 'High');
      if (lower.includes('moderate')) return presentNumber(2, 'Moderate');
      if (lower.includes('low')) return presentNumber(1, 'Low');
      return presentString(s);
    },
  },
  {
    id: 'fault',
    label: 'Nearest active fault',
    strategy: 'higher-better', // farther = better
    extract: (r) => {
      const f = r.hazards.active_fault_nearest;
      if (!f || f.distance_m == null) return unknown();
      return presentNumber(
        f.distance_m,
        f.distance_m < 1000
          ? `${f.distance_m}m (${f.name})`
          : `${(f.distance_m / 1000).toFixed(1)}km (${f.name})`,
      );
    },
    formatDelta: (winner, loser) => {
      if (winner.kind !== 'present' || loser.kind !== 'present') return '';
      const dw = winner.value as number;
      const dl = loser.value as number;
      const diff = dw - dl;
      return `${diff >= 1000 ? `${(diff / 1000).toFixed(1)}km` : `${Math.round(diff)}m`} farther from a fault`;
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
    formatDelta: (winner, loser) => {
      if (winner.kind !== 'present' || loser.kind !== 'present') return '';
      const diff = ((winner.value as number) - (loser.value as number)) / 100;
      return `${diff.toFixed(1)}m higher above sea level`;
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
    id: 'median-rent',
    label: 'Median rent (suburb)',
    strategy: 'lower-better',
    extract: (r) => {
      const m = r.market.rent_assessment?.median;
      if (m == null) return unknown();
      return presentNumber(m, `${fmtCurrency0(m)}/wk`);
    },
    formatDelta: (w, l) => {
      if (w.kind !== 'present' || l.kind !== 'present') return '';
      const diff = (l.value as number) - (w.value as number);
      return `$${Math.round(diff)}/wk cheaper`;
    },
  },
  {
    id: 'rent-band',
    label: 'Rent range (LQ–UQ)',
    strategy: 'identity',
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
      const label = h.charAt(0).toUpperCase() + h.slice(1);
      return presentString(h, label);
    },
  },
];

// ── Section list (Phase A: Risk + Market only) ──────────────────────────

export const SECTIONS: SectionDef[] = [
  {
    id: 'risk',
    title: 'Risk & Hazards',
    rows: riskRows,
    defaultOpenOn: ['buyer', 'desktop'],
  },
  {
    id: 'market',
    title: 'Market',
    rows: marketRows,
    defaultOpenOn: ['renter', 'buyer', 'desktop'],
  },
];

/** Persona-driven section ordering (Phase A: only 2 sections, but the helper
 *  is in place for Phase B's 8 sections). */
export function orderedSections(persona: Persona): SectionDef[] {
  if (persona === 'renter') {
    // Renter: Market first, Risk second.
    return [...SECTIONS].sort((a, b) => {
      if (a.id === 'market') return -1;
      if (b.id === 'market') return 1;
      return 0;
    });
  }
  // Buyer: keep declared order (Risk first).
  return SECTIONS;
}
