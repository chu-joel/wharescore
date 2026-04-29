/**
 * Pure helpers for the compare view's tri-state diff logic.
 *
 * Tri-state per row:
 *   - present       (number/string value)
 *   - negativeKnown (data exists, this property has none of this hazard)
 *   - unknown       (city/region has no coverage — never wins a comparison)
 *
 * Critical invariant: if ANY value is `unknown`, winnerOf() returns null and
 * diffSentence() reports "Data not available for {col}". Never silently treats
 * unknown as a winning value.
 */

export type DiffStrategy =
  | 'lower-better'   // smaller numeric wins (price, rent, distance, count of bad things)
  | 'higher-better'  // larger numeric wins (count of good things, score-where-bigger-better)
  | 'categorical'    // string match — only "all same" vs "different"
  | 'identity';      // never picks a winner (factual rows like "year built")

export type CompareValue =
  | { kind: 'present'; value: number | string; display: string }
  | { kind: 'negativeKnown'; display: string }      // e.g. "None", "Not in zone"
  | { kind: 'unknown' };                             // e.g. city has no coverage

export interface ColumnLabel {
  letter: 'A' | 'B' | 'C';
  shortAddress: string; // "14 Smith St"
}

/**
 * Pick the winning column index, or null if no winner can be declared.
 * Returns null when:
 *   - any value is unknown
 *   - strategy is 'identity'
 *   - all values are equal
 *   - strategy is 'categorical' and any pair differs (no single winner)
 */
export function winnerOf(
  values: CompareValue[],
  strategy: DiffStrategy,
): number | null {
  if (strategy === 'identity') return null;
  if (values.some((v) => v.kind === 'unknown')) return null;

  // Treat negativeKnown as "best possible" for the lower-better hazard rows
  // (e.g. flood = "None" beats flood = "moderate"). For higher-better rows,
  // negativeKnown is the worst (e.g. 0 schools beats nothing... actually 0
  // schools is just 0, so the present-with-value path handles it. For
  // negativeKnown to appear in a higher-better row would be a misconfigured
  // section — fail safe by treating it as worst.)
  if (strategy === 'lower-better' || strategy === 'higher-better') {
    const numericValues = values.map((v) => {
      if (v.kind === 'negativeKnown') {
        return strategy === 'lower-better' ? -Infinity : Infinity;
      }
      if (v.kind === 'present' && typeof v.value === 'number') return v.value;
      return null; // mixed string/number — unrankable
    });
    if (numericValues.some((n) => n === null)) return null;
    const allSame = numericValues.every((n) => n === numericValues[0]);
    if (allSame) return null;
    if (strategy === 'lower-better') {
      let bestIdx = 0;
      for (let i = 1; i < numericValues.length; i++) {
        if ((numericValues[i] as number) < (numericValues[bestIdx] as number)) bestIdx = i;
      }
      return bestIdx;
    }
    let bestIdx = 0;
    for (let i = 1; i < numericValues.length; i++) {
      if ((numericValues[i] as number) > (numericValues[bestIdx] as number)) bestIdx = i;
    }
    return bestIdx;
  }

  if (strategy === 'categorical') {
    // No single winner — categorical rows render "Same" or "Different" only.
    return null;
  }

  return null;
}

/**
 * "All values are the same" — used to collapse identical rows into a "Same:" trailer.
 * Two unknowns count as identical (both render as "—") so coverage gaps don't
 * needlessly inflate the visible row count.
 */
export function isIdentical(values: CompareValue[]): boolean {
  if (values.length < 2) return false;
  const first = values[0];
  return values.every((v) => {
    if (v.kind !== first.kind) return false;
    if (v.kind === 'unknown') return true;
    if (first.kind === 'unknown') return true;
    return v.display === first.display;
  });
}

/**
 * Build the diff sentence for a row. Short, scannable, names a column when
 * relevant. Returns null for identity rows or when no meaningful diff exists.
 */
export function diffSentence(
  values: CompareValue[],
  strategy: DiffStrategy,
  columns: ColumnLabel[],
  formatDelta?: (winner: CompareValue, loser: CompareValue) => string,
): string | null {
  if (values.length !== columns.length) return null;

  // Check unknown before short-circuiting on strategy — even an "identity"
  // row deserves a "data not available" caption when one column is missing
  // data, otherwise the user just sees "—" with no explanation.
  const unknownIdxs = values
    .map((v, i) => (v.kind === 'unknown' ? i : -1))
    .filter((i) => i >= 0);
  if (unknownIdxs.length > 0) {
    if (unknownIdxs.length === values.length) return null; // all unknown — no row
    const names = unknownIdxs.map((i) => columns[i].shortAddress).join(' and ');
    return `Data not available for ${names}`;
  }

  if (strategy === 'identity') return null;

  if (strategy === 'categorical') {
    return isIdentical(values) ? null : 'Different categories';
  }

  const winner = winnerOf(values, strategy);
  if (winner === null) return null;

  const winnerVal = values[winner];
  // Pick the "loser" closest in value (or just the first non-winner) to compute delta.
  const loserIdx = values.findIndex((_, i) => i !== winner);
  const loserVal = values[loserIdx];

  if (formatDelta && winnerVal.kind !== 'unknown' && loserVal.kind !== 'unknown') {
    const delta = formatDelta(winnerVal, loserVal);
    return `${columns[winner].shortAddress} ${delta}`;
  }

  return `${columns[winner].shortAddress} ${strategy === 'lower-better' ? 'lower' : 'higher'}`;
}

/**
 * Helpers to construct CompareValue from raw fields, encapsulating the
 * tri-state decision so call sites can stay declarative.
 */
export function presentNumber(value: number, display: string): CompareValue {
  return { kind: 'present', value, display };
}

export function presentString(value: string, display?: string): CompareValue {
  return { kind: 'present', value, display: display ?? value };
}

export function negativeKnown(display: string): CompareValue {
  return { kind: 'negativeKnown', display };
}

export function unknown(): CompareValue {
  return { kind: 'unknown' };
}
