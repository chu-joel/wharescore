'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { formatDistance } from '@/lib/format';
import { ThumbsUp, AlertTriangle, Info } from 'lucide-react';
import { useHostedReport } from '@/components/report/HostedReportContext';

interface AmenityItem {
  name: string;
  label: string;
  subcategory: string;
  distance_m: number;
}

interface HighlightsResponse {
  good: AmenityItem[];
  caution: AmenityItem[];
  info: AmenityItem[];
}

export function NearbyAmenities({ addressId }: { addressId: number }) {
  const hosted = useHostedReport();
  const { data, isLoading } = useQuery({
    queryKey: ['nearby-highlights', addressId],
    queryFn: () => apiFetch<HighlightsResponse>(`/api/v1/nearby/${addressId}/highlights`),
    staleTime: 10 * 60 * 1000,
    enabled: !hosted, // Skip API call in hosted mode
  });

  // In hosted mode, skip this component (data not in snapshot)
  if (hosted) return null;

  if (isLoading) {
    return <div className="text-xs text-muted-foreground py-2">Loading nearby amenities...</div>;
  }

  if (!data) return null;

  const { good, caution, info } = data;
  const hasAny = good.length > 0 || caution.length > 0 || info.length > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">What's Nearby</h4>

      {/* Good amenities */}
      {good.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>Good to have nearby</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {good.slice(0, 8).map((item) => (
              <span
                key={item.subcategory}
                className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs dark:border-green-800 dark:bg-green-950/30"
                title={`${item.name}. ${formatDistance(item.distance_m)}`}
              >
                {item.label}
                <span className="text-muted-foreground">{formatDistance(item.distance_m)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Caution amenities */}
      {caution.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Be aware</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {caution.slice(0, 6).map((item) => (
              <span
                key={item.subcategory}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs dark:border-amber-800 dark:bg-amber-950/30"
                title={`${item.name}. ${formatDistance(item.distance_m)}`}
              >
                {item.label}
                <span className="text-muted-foreground">{formatDistance(item.distance_m)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Info amenities */}
      {info.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
            <Info className="h-3.5 w-3.5" />
            <span>Also nearby</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {info.slice(0, 6).map((item) => (
              <span
                key={item.subcategory}
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs dark:border-blue-800 dark:bg-blue-950/30"
                title={`${item.name}. ${formatDistance(item.distance_m)}`}
              >
                {item.label}
                <span className="text-muted-foreground">{formatDistance(item.distance_m)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
