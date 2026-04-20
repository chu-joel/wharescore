'use client';

import { IndicatorCard } from '@/components/common/IndicatorCard';
import { EmptyState } from '@/components/common/EmptyState';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import { NearbyAmenities } from '@/components/property/NearbyAmenities';
import { CrimeCard } from '@/components/property/CrimeCard';
import type { CategoryScore, LiveabilityData } from '@/lib/types';

interface NeighbourhoodSectionProps {
  category: CategoryScore;
  liveability: LiveabilityData;
  addressId: number;
  persona?: 'renter' | 'buyer';
}

export function NeighbourhoodSection({ category, liveability, addressId, persona }: NeighbourhoodSectionProps) {
  const available = category.indicators.filter((i) => i.is_available);
  const unavailable = category.indicators.filter((i) => !i.is_available);
  const isRenter = persona === 'renter';

  if (available.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title="No neighbourhood data available"
        description="Neighbourhood data is not yet available for this location."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* NZDep highlight */}
      {liveability.nzdep_score !== null && (
        <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Deprivation Index</span>
            <span className="text-sm font-semibold tabular-nums">
              {liveability.nzdep_score}/10
            </span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-sm ${
                  i < liveability.nzdep_score!
                    ? i < 3 ? 'bg-piq-success' : i < 7 ? 'bg-yellow-400' : 'bg-risk-high'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">Least deprived</span>
            <span className="text-xs text-muted-foreground">Most deprived</span>
          </div>
        </div>
      )}

      {/* Crime card. buyers only. Renters already see this in the
          "Is it safe?" section above, so rendering it twice in the
          same report is noise. */}
      {!isRenter && (
        <CrimeCard
          percentile={liveability.crime_rate}
          victimisations={liveability.crime_victimisations}
          cityMedian={liveability.crime_city_median}
        />
      )}

      {/* Indicator cards grid. buyers only */}
      {!isRenter && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {available.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      {!isRenter && unavailable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {unavailable.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      {/* What's Nearby. good / caution / info amenities */}
      <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
        <NearbyAmenities addressId={addressId} />
      </div>

      <DataSourceBadge source="NZ Police, Stats NZ, MoE, OSM, DOC" />
    </div>
  );
}
