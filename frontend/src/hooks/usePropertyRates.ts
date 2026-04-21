import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface LiveRates {
  current_valuation?: {
    capital_value?: number;
    land_value?: number;
    improvements_value?: number;
  };
  /** Per-unit valued floor area (AKCC / WDC / ICC only). Prefer over the
   * shared LINZ polygon for cross-lease / semi-detached addresses. */
  total_floor_area_sqm?: number | null;
  /** Per-unit building site coverage in m² (Auckland only). */
  building_site_coverage_pct?: number | null;
  /** Source tag for attribution (e.g. 'akcc', 'wdc_arcgis', 'icc_arcgis'). */
  source?: string | null;
  rates_breakdown?: Array<{ name: string; amount: number }>;
  total_rates?: number;
}

/**
 * Lazily fetch live council rates for a property.
 * Fires after the report has loaded. Supports all 25 councils.
 * Returns null when the city has no rates integration (404).
 *
 * The caller is responsible for displaying the live CV in place of the DB CV.
 * No report cache invalidation. the UI updates inline.
 */
export function usePropertyRates(addressId: number | null, enabled: boolean = true) {
  return useQuery<LiveRates | null>({
    queryKey: ['property-rates', addressId],
    queryFn: async () => {
      try {
        return await apiFetch<LiveRates>(`/api/v1/property/${addressId}/rates`);
      } catch {
        // 404 = no rates integration for this city. not an error
        return null;
      }
    },
    enabled: addressId !== null && enabled,
    staleTime: 60 * 60 * 1000, // 1h
    retry: false,
  });
}
