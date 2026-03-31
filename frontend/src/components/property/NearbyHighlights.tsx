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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      {/* Closest Supermarket */}
      <div className="rounded-xl border border-border bg-card p-3 text-center space-y-1.5 card-elevated animate-fade-in-up stagger-1">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 mx-auto">
          <ShoppingCart className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        </div>
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
      <div className="rounded-xl border border-border bg-card p-3 text-center space-y-1.5 card-elevated animate-fade-in-up stagger-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto">
          <GraduationCap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
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
      <div className="rounded-xl border border-border bg-card p-3 text-center space-y-1.5 card-elevated animate-fade-in-up stagger-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto">
          <Bus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
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
