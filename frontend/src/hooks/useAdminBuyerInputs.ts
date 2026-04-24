import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';

export interface BuyerInputsAggregate {
  total: number;
  last_7d: number;
  last_30d: number;
  distinct_addresses: number;
  distinct_sa2s: number;
  distinct_contributors: number;
  trend_30d: { day: string; count: number }[];
  by_city: { city: string; submissions: number; distinct_addresses: number; median_asking: number | null }[];
  by_bedrooms: { bedrooms: string; count: number; median_asking: number | null }[];
  by_bathrooms: { bathrooms: string; count: number; median_asking: number | null }[];
  by_finish_tier: { finish_tier: string; count: number; median_asking: number | null }[];
  by_price_band: { band: string; count: number }[];
  by_source: { source: string; count: number }[];
  completeness: {
    total: number;
    has_asking_price: number;
    has_purchase_price: number;
    has_bedrooms: number;
    has_bathrooms: number;
    has_finish_tier: number;
    has_parking_noted: number;
    has_deposit: number;
    has_income: number;
  };
}

export function useAdminBuyerInputs() {
  const { getToken } = useAuthToken();
  return useQuery<BuyerInputsAggregate>({
    queryKey: ['admin', 'analytics', 'buyer-inputs'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<BuyerInputsAggregate>(
        '/api/v1/admin/analytics/buyer-inputs',
        { token: token ?? undefined }
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}
