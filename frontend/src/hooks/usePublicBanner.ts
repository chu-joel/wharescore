import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type BannerType = 'info' | 'warning' | 'success';

export interface PublicBanner {
  text: string;
  type: BannerType;
}

export function usePublicBanner() {
  return useQuery<PublicBanner | null>({
    queryKey: ['public', 'banner'],
    queryFn: () => apiFetch<PublicBanner | null>('/api/v1/public/banner'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
