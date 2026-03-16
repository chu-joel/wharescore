'use client';

import { AlertTriangle } from 'lucide-react';
import { IndicatorCard } from '@/components/common/IndicatorCard';
import { EmptyState } from '@/components/common/EmptyState';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import { EarthquakeDetailCard } from '@/components/property/EarthquakeDetailCard';
import type { CategoryScore, HazardData } from '@/lib/types';

interface RiskHazardsSectionProps {
  category: CategoryScore;
  hazards?: HazardData;
}

export function RiskHazardsSection({ category, hazards }: RiskHazardsSectionProps) {
  const available = category.indicators.filter((i) => i.is_available);
  const critical = available.filter((i) => i.score >= 60);
  const normal = available.filter((i) => i.score < 60);
  const unavailable = category.indicators.filter((i) => !i.is_available);

  if (available.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title="No hazard data available"
        description="Hazard data is not yet available for this location."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Earthquake detail card */}
      {hazards && <EarthquakeDetailCard hazards={hazards} />}

      {/* Critical findings first */}
      {critical.length > 0 && (
        <div className="space-y-2">
          {critical.map((indicator) => (
            <div
              key={indicator.name}
              className="border-l-[5px] border-risk-very-high rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3.5 flex items-start gap-2.5 shadow-sm shadow-red-200 dark:shadow-red-900/50"
            >
              {indicator.score >= 80 && (
                <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
              <AlertTriangle className="h-4 w-4 text-risk-very-high shrink-0 mt-0.5" />
              <div className="flex-1">
                <IndicatorCard indicator={indicator} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Normal indicators in 2-col grid */}
      {normal.length > 0 && (
        <>
          {critical.length === 0 && (
            <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 p-3">
              <EmptyState
                variant="no-risk"
                title="No significant hazard risks detected"
                description={`${available.length} hazard indicators assessed for this location.`}
              />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {normal.map((indicator) => (
              <IndicatorCard key={indicator.name} indicator={indicator} />
            ))}
          </div>
        </>
      )}

      {/* Unavailable indicators */}
      {unavailable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {unavailable.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      <DataSourceBadge source="GWRC, GNS, NIWA, Waka Kotahi, MfE" />
    </div>
  );
}
