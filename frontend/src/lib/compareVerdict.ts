/**
 * Synthesise a head-to-head verdict from compare row results.
 *
 * The verdict is the *thing the user actually wants* — a 1-2 sentence
 * "tl;dr" of which property is stronger and where, before they drill into
 * any row. Deterministic, no AI: walks the same rows the page renders,
 * picks the most significant per-column wins, and composes a sentence.
 */

import type { PropertyReport } from './types';
import type { ColumnLabel } from './compareDiff';
import { winnerOf } from './compareDiff';
import { SECTIONS } from './compareSections';

export interface VerdictHighlight {
  /** Row id e.g. "capital-value" */
  rowId: string;
  /** Section the row lives in */
  sectionId: string;
  /** Which column won */
  winner: number;
  /** Section title for display */
  sectionTitle: string;
  /** A short clause like "$225k cheaper" or "16 points lower risk" */
  clause: string;
  /** Significance ranking (higher = more important) */
  weight: number;
}

export interface CompareVerdict {
  /** Per-column winning-row counts */
  wins: number[];
  /** Top N highlights, ordered by significance */
  highlights: VerdictHighlight[];
  /** A short headline sentence per column ("Property A: cheaper, lower risk") */
  perColumnSummary: string[];
  /** "Mostly A" / "Mixed" / "Tied" — used for the card eyebrow */
  overall: string;
  /** Total measurable rows compared */
  rowsCompared: number;
}

const WEIGHTS: Record<string, number> = {
  // Headline financial — these matter most
  'capital-value': 100,
  'median-rent': 95,
  'land-value': 60,
  'cagr-1yr': 50,
  // Risk — second most significant
  flood: 90,
  liquefaction: 80,
  tsunami: 80,
  landslide: 70,
  'coastal-erosion': 65,
  wildfire: 60,
  'coastal-elevation': 50,
  fault: 45,
  epb: 40,
  contamination: 40,
  // Liveability / lifestyle
  schools: 55,
  'walking-reach': 50,
  amenities: 45,
  'gp-distance': 40,
  noise: 40,
  deprivation: 50,
  parks: 35,
  // Transport
  'transit-stops': 50,
  'cbd-distance': 60,
  'bus-stops': 35,
  'rail-stops': 35,
  'peak-trips': 30,
  // Planning + property + crime
  zone: 20,
  'height-limit': 15,
  heritage: 25,
  'character-precinct': 30,
  'special-character': 25,
  'ecological-area': 20,
  'land-area': 50,
  'floor-area': 50,
  'crime-rate': 70,
  'crime-vs-city': 70,
};

/**
 * Build a short clause describing the win. Uses each row's `formatDelta`
 * when present (already produces "$225k cheaper" / "12 min closer to CBD"
 * style strings); falls back to a generic "lower / higher" otherwise.
 */
function buildClause(rowDef: {
  id: string;
  label: string;
  formatDelta?: (a: import('./compareDiff').CompareValue, b: import('./compareDiff').CompareValue) => string;
}, winnerVal: import('./compareDiff').CompareValue, loserVal: import('./compareDiff').CompareValue, strategy: 'lower-better' | 'higher-better' | 'categorical' | 'identity'): string {
  if (rowDef.formatDelta) {
    const txt = rowDef.formatDelta(winnerVal, loserVal);
    if (txt) return txt;
  }
  if (winnerVal.kind === 'present' && loserVal.kind === 'present') {
    if (strategy === 'lower-better') return `${rowDef.label.toLowerCase()} lower`;
    if (strategy === 'higher-better') return `${rowDef.label.toLowerCase()} higher`;
  }
  if (winnerVal.kind === 'negativeKnown' && loserVal.kind === 'present') {
    return `no ${rowDef.label.toLowerCase()}`;
  }
  return `wins on ${rowDef.label.toLowerCase()}`;
}

export function buildVerdict(
  reports: PropertyReport[],
  columns: ColumnLabel[],
): CompareVerdict {
  const colCount = reports.length;
  const wins = new Array<number>(colCount).fill(0);
  const highlights: VerdictHighlight[] = [];
  let rowsCompared = 0;

  for (const section of SECTIONS) {
    for (const row of section.rows) {
      const values = reports.map((r) => row.extract(r));
      const winner = winnerOf(values, row.strategy);
      if (winner === null) continue;
      rowsCompared += 1;
      wins[winner] += 1;

      // Pick "most representative loser" — for a 2-property compare the
      // single non-winner; for a 3-property compare the worst non-winner so
      // the magnitude reflects the biggest gap.
      const loserIdx = values.findIndex((_, i) => i !== winner);
      if (loserIdx === -1) continue;

      const clause = buildClause(row, values[winner], values[loserIdx], row.strategy);
      const weight = WEIGHTS[row.id] ?? 25;

      highlights.push({
        rowId: row.id,
        sectionId: section.id,
        sectionTitle: section.title,
        winner,
        clause,
        weight,
      });
    }
  }

  // Sort by weight, take top 6 overall, then build per-column "best 2"
  highlights.sort((a, b) => b.weight - a.weight);

  const perColumnSummary = columns.map((col, idx) => {
    const top = highlights.filter((h) => h.winner === idx).slice(0, 3);
    if (top.length === 0) return `${col.shortAddress}: no standout advantages`;
    const clauses = top.map((h) => h.clause);
    return `${col.shortAddress}: ${clauses.join('; ')}`;
  });

  const maxWins = Math.max(...wins);
  const dominant = wins.filter((w) => w === maxWins).length;
  let overall: string;
  if (rowsCompared === 0) {
    overall = 'Limited data overlap';
  } else if (dominant > 1) {
    overall = 'Closely matched';
  } else {
    const leader = wins.indexOf(maxWins);
    const lead = maxWins - Math.max(...wins.filter((_, i) => i !== leader), 0);
    if (lead >= rowsCompared * 0.4) {
      overall = `${columns[leader].shortAddress} stronger`;
    } else {
      overall = `${columns[leader].shortAddress} edges ahead`;
    }
  }

  return {
    wins,
    highlights: highlights.slice(0, 6),
    perColumnSummary,
    overall,
    rowsCompared,
  };
}

/** Section-level win counts for the accordion header subtitle. */
export function sectionWinCounts(
  reports: PropertyReport[],
  sectionId: string,
  columnCount: number,
): { wins: number[]; total: number } {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section) return { wins: new Array(columnCount).fill(0), total: 0 };
  const wins = new Array<number>(columnCount).fill(0);
  let total = 0;
  for (const row of section.rows) {
    const values = reports.map((r) => row.extract(r));
    const w = winnerOf(values, row.strategy);
    if (w !== null) {
      wins[w] += 1;
      total += 1;
    }
  }
  return { wins, total };
}

/** Haversine distance between two lat/lng points in km. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371; // earth radius km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m apart`;
  if (km < 10) return `${km.toFixed(1)}km apart`;
  return `${Math.round(km)}km apart`;
}
