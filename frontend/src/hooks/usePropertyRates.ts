import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface LiveRates {
  current_valuation?: {
    capital_value?: number;
    land_value?: number;
    improvements_value?: number;
  };
  rates_breakdown?: Array<{ name: string; amount: number }>;
  total_rates?: number;
}

/**
 * Lazily fetch live council rates for a property.
 * Fires after the report has loaded. Supports all 25 councils.
 * Returns null when the city has no rates integration (404).
 *
 * The caller is responsible for displaying the live CV in place of the DB CV.
 * No report cache invalidation — the UI updates inline.
 */
export function usePropertyRates(addressId: number | null, enabled: boolean = true) {
  return useQuery<LiveRates | null>({
    queryKey: ['property-rates', addressId],
    queryFn: async () => {
      try {
        return await apiFetch<LiveRates>(`/api/v1/property/${addressId}/rates`);
      } catch {
        // 404 = no rates integration for this city — not an error
        return null;
      }
    },
    enabled: addressId !== null && enabled,
    staleTime: 60 * 60 * 1000, // 1h
    retry: false,
  });
}
