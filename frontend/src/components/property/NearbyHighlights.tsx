'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { formatDistance } from '@/lib/format';
import { ShoppingCart, GraduationCap, Bus } from 'lucide-react';

interface NearbyHighlightsProps {
  addressId: number;
  schoolCount: number | null;
  transitCount: number | null;
}

interface SupermarketFeature {
  properties: {
    name: string;
    distance_m: number;
  };
}

export function NearbyHighlights({ addressId, schoolCount, transitCount }: NearbyHighlightsProps) {
  const { data } = useQuery({
    queryKey: ['supermarkets', addressId],
    queryFn: () =>
      apiFetch<{ features: SupermarketFeature[] }>(
        `/api/v1/nearby/${addressId}/supermarkets`
      ),
    staleTime: 10 * 60 * 1000,
  });

  const closest = data?.features?.[0]?.properties;

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Closest Supermarket */}
      <div className="rounded-lg border border-border p-2.5 text-center space-y-1">
        <ShoppingCart className="h-4 w-4 mx-auto text-pink-500" />
        {closest ? (
          <>
            <p className="text-xs font-semibold truncate" title={closest.name}>{closest.name}</p>
            <p className="text-[11px] text-muted-foreground">{formatDistance(closest.distance_m)}</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No data</p>
        )}
      </div>

      {/* Schools in zone */}
      <div className="rounded-lg border border-border p-2.5 text-center space-y-1">
        <GraduationCap className="h-4 w-4 mx-auto text-green-600" />
        {schoolCount !== null ? (
          <>
            <p className="text-xs font-semibold">{schoolCount} school{schoolCount !== 1 ? 's' : ''}</p>
            <p className="text-[11px] text-muted-foreground">within 1.5km</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No data</p>
        )}
      </div>

      {/* Transit stops */}
      <div className="rounded-lg border border-border p-2.5 text-center space-y-1">
        <Bus className="h-4 w-4 mx-auto text-orange-500" />
        {transitCount !== null ? (
          <>
            <p className="text-xs font-semibold">{transitCount} stop{transitCount !== 1 ? 's' : ''}</p>
            <p className="text-[11px] text-muted-foreground">within 400m</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No data</p>
        )}
      </div>
    </div>
  );
}
