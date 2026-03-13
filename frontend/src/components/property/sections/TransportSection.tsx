'use client';

import { IndicatorCard } from '@/components/common/IndicatorCard';
import { EmptyState } from '@/components/common/EmptyState';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import { formatDistance } from '@/lib/format';
import { Building2, TrainFront } from 'lucide-react';
import type { CategoryScore, LiveabilityData } from '@/lib/types';

interface TransportSectionProps {
  category: CategoryScore;
  liveability: LiveabilityData;
}

export function TransportSection({ category, liveability }: TransportSectionProps) {
  const available = category.indicators.filter((i) => i.is_available);
  const unavailable = category.indicators.filter((i) => !i.is_available);

  const cbdDistance = liveability.cbd_distance_m;
  const trainDistance = liveability.nearest_train_m;

  return (
    <div className="space-y-3">
      {/* Distance cards */}
      {(cbdDistance || trainDistance) && (
        <div className="rounded-lg border border-border p-3">
          <span className="text-sm font-semibold">Distances</span>
          <div className="mt-2 space-y-1.5">
            {cbdDistance && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">To CBD</span>
                <span className="ml-auto font-semibold tabular-nums">{formatDistance(cbdDistance)}</span>
              </div>
            )}
            {trainDistance && (
              <div className="flex items-center gap-2 text-sm">
                <TrainFront className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Nearest train station</span>
                <span className="ml-auto font-semibold tabular-nums">{formatDistance(trainDistance)}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Straight-line distance</p>
        </div>
      )}

      {/* Indicator cards grid */}
      {available.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {available.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      ) : (
        <EmptyState
          variant="no-data"
          title="No transport data available"
          description="Transport indicators are not available for this location."
        />
      )}

      {unavailable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {unavailable.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      <DataSourceBadge source="Metlink GTFS, Waka Kotahi CAS" />
    </div>
  );
}
