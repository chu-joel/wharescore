import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface AreaFeedEvent {
  source: 'geonet' | 'nema' | 'metservice' | 'volcano';
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  distance_km: number | null;
  magnitude?: number;
  mmi?: number;
  active?: boolean;
}

export interface AreaFeedResponse {
  summary: {
    total_events: number;
    critical: number;
    warning: number;
    info: number;
    headline: string;
  };
  events: AreaFeedEvent[];
}

export function useAreaFeed(addressId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['area-feed', addressId],
    queryFn: () => apiFetch<AreaFeedResponse>(`/api/v1/property/${addressId}/area-feed`),
    enabled: addressId !== null && enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes — matches backend cache
    retry: false,
  });
}
