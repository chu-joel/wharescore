import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface RatesData {
  current_valuation?: {
    capital_value?: number;
    land_value?: number;
    improvements_value?: number;
  };
  rates_breakdown?: Array<{ name: string; amount: number }>;
  total_rates?: number;
  [key: string]: unknown;
}

/**
 * Fetch live council rates/valuation for a property.
 * Called in parallel with the main report — fills in accurate CV after load.
 * On success, invalidates the property report cache so next render picks up updated CV.
 */
export function usePropertyRates(addressId: number | null, enabled: boolean = true) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['property-rates', addressId],
    queryFn: async () => {
      const data = await apiFetch<RatesData | null>(`/api/v1/property/${addressId}/rates`);
      // Invalidate the property report query so it refetches with updated CV
      if (data?.current_valuation?.capital_value) {
        queryClient.invalidateQueries({ queryKey: ['property-report', addressId] });
      }
      return data;
    },
    enabled: addressId !== null && enabled,
    staleTime: 60 * 60 * 1000, // 1h — matches backend cache
    retry: false,
  });
}
