// Returns the SA2 median rent for the typology the user has selected
// (dwelling type + bedrooms), with a sensible fallback chain when the
// SA2 doesn't carry a row for that exact combo. The bond count surfaces
// alongside so callers can fade out comparisons that lean on thin data.
//
// Fallback chain:
//   1. exact match (Apartment / 2)
//   2. dwelling-only (Apartment / ALL)
//   3. beds-only (ALL / 2)
//   4. SA2-wide (ALL / ALL) — what the report's
//      `report.market.rent_assessment.median` already returns
//
// `kind` lets callers tell whether they're showing a typology-specific
// number or a wider fallback so the UI can label it appropriately.
import { useMemo } from 'react';
import { usePropertyDetailsStore, type DwellingType, type Bedrooms } from '@/stores/propertyDetailsStore';

interface RawRentalRow {
  dwelling_type: string | null;
  beds: string | null;
  median: number | null;
  lq: number | null;
  uq: number | null;
  bonds: number | null;
}

export type MedianMatchKind = 'exact' | 'dwelling' | 'beds' | 'sa2' | 'none';

export interface TypologyMedian {
  median: number | null;
  lq: number | null;
  uq: number | null;
  bonds: number;
  kind: MedianMatchKind;
  dwellingType: DwellingType | null;
  bedrooms: Bedrooms | null;
  /** True when the chosen row has < 10 bonds so callers can soften copy. */
  thin: boolean;
}

function pickRow(
  rows: RawRentalRow[],
  dwelling: string,
  beds: string,
): RawRentalRow | undefined {
  return rows.find(
    (r) => (r.dwelling_type ?? 'ALL') === dwelling && (r.beds ?? 'ALL') === beds,
  );
}

export function useTypologyMedian(rentalOverview: RawRentalRow[] | null | undefined): TypologyMedian {
  const dwellingType = usePropertyDetailsStore((s) => s.dwellingType);
  const bedrooms = usePropertyDetailsStore((s) => s.bedrooms);

  return useMemo<TypologyMedian>(() => {
    const rows = Array.isArray(rentalOverview) ? rentalOverview : [];
    if (rows.length === 0) {
      return {
        median: null, lq: null, uq: null, bonds: 0, kind: 'none',
        dwellingType, bedrooms, thin: true,
      };
    }

    const dw = dwellingType ?? 'ALL';
    const bd = bedrooms ?? 'ALL';

    const exact = dw !== 'ALL' && bd !== 'ALL' ? pickRow(rows, dw, bd) : undefined;
    if (exact?.median != null) {
      return {
        median: exact.median, lq: exact.lq, uq: exact.uq, bonds: exact.bonds ?? 0,
        kind: 'exact', dwellingType, bedrooms, thin: (exact.bonds ?? 0) < 10,
      };
    }

    const dwellingOnly = dw !== 'ALL' ? pickRow(rows, dw, 'ALL') : undefined;
    if (dwellingOnly?.median != null) {
      return {
        median: dwellingOnly.median, lq: dwellingOnly.lq, uq: dwellingOnly.uq,
        bonds: dwellingOnly.bonds ?? 0, kind: 'dwelling',
        dwellingType, bedrooms, thin: (dwellingOnly.bonds ?? 0) < 10,
      };
    }

    const bedsOnly = bd !== 'ALL' ? pickRow(rows, 'ALL', bd) : undefined;
    if (bedsOnly?.median != null) {
      return {
        median: bedsOnly.median, lq: bedsOnly.lq, uq: bedsOnly.uq,
        bonds: bedsOnly.bonds ?? 0, kind: 'beds',
        dwellingType, bedrooms, thin: (bedsOnly.bonds ?? 0) < 10,
      };
    }

    const sa2 = pickRow(rows, 'ALL', 'ALL');
    if (sa2?.median != null) {
      return {
        median: sa2.median, lq: sa2.lq, uq: sa2.uq, bonds: sa2.bonds ?? 0,
        kind: 'sa2', dwellingType, bedrooms, thin: (sa2.bonds ?? 0) < 10,
      };
    }

    return {
      median: null, lq: null, uq: null, bonds: 0, kind: 'none',
      dwellingType, bedrooms, thin: true,
    };
  }, [rentalOverview, dwellingType, bedrooms]);
}

/** Pick a sensible default bedrooms count for a given dwelling type and SA2:
 *  the bedroom row with the most bonds for that dwelling. Used to seed the
 *  property-details chip on first view so the median we surface isn't a
 *  random pick. */
export function defaultBedroomsForSA2(
  rentalOverview: RawRentalRow[] | null | undefined,
  dwellingType: DwellingType | null,
): Bedrooms | null {
  const rows = Array.isArray(rentalOverview) ? rentalOverview : [];
  if (rows.length === 0) return null;
  const dw = dwellingType ?? 'ALL';
  const candidates = rows.filter(
    (r) =>
      (r.dwelling_type ?? 'ALL') === dw &&
      r.beds !== 'ALL' &&
      r.beds !== 'NA' &&
      (r.bonds ?? 0) > 0,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.bonds ?? 0) - (a.bonds ?? 0));
  const top = candidates[0]?.beds;
  if (top === '1' || top === '2' || top === '3' || top === '4' || top === '5+') return top;
  return null;
}
