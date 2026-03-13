'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { MapPin } from 'lucide-react';
import { formatDistance } from '@/lib/format';

interface Supermarket {
  properties: {
    name: string;
    category: string;
    subcategory?: string;
    distance_m: number;
    lng: number;
    lat: number;
  };
}

interface SupermarketsProps {
  addressId: number;
}

export function Supermarkets({ addressId }: SupermarketsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['supermarkets', addressId],
    queryFn: () =>
      apiFetch<{ type: string; features: Supermarket[] }>(
        `/api/v1/nearby/${addressId}/supermarkets`
      ),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading supermarkets...</div>;
  }

  const supermarkets = data?.features || [];

  if (supermarkets.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No supermarkets found nearby</div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm">Closest Supermarkets</h3>
      <div className="space-y-1.5">
        {supermarkets.map((item, i) => {
          const props = item.properties;
          return (
            <div
              key={i}
              className="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <MapPin className="h-4 w-4 text-piq-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium leading-snug truncate">{props.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistance(props.distance_m)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
