import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';

export interface RentReportsAggregate {
  total: number;
  outliers: number;
  last_7d: number;
  last_30d: number;
  distinct_addresses: number;
  distinct_sa2s: number;
  distinct_contributors: number;
  trend_30d: { day: string; count: number }[];
  by_city: { city: string; reports: number; distinct_addresses: number; median_rent: number | null }[];
  by_bedrooms: { bedrooms: string; count: number; median_rent: number | null }[];
  by_bathrooms: { bathrooms: string; count: number; median_rent: number | null }[];
  by_dwelling_type: { dwelling_type: string; count: number; median_rent: number | null }[];
  by_source: { source: string; count: number }[];
  completeness: {
    total: number;
    has_bathrooms: number;
    has_finish_tier: number;
    has_parking: number;
    has_furnished: number;
    has_outdoor_space: number;
    has_character: number;
    has_utilities: number;
    has_insulation_note: number;
  };
}

export function useAdminRentReports() {
  const { getToken } = useAuthToken();
  return useQuery<RentReportsAggregate>({
    queryKey: ['admin', 'analytics', 'rent-reports'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<RentReportsAggregate>(
        '/api/v1/admin/analytics/rent-reports',
        { token: token ?? undefined }
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}
