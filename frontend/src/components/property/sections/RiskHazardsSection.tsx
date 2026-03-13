'use client';

import { AlertTriangle } from 'lucide-react';
import { IndicatorCard } from '@/components/common/IndicatorCard';
import { EmptyState } from '@/components/common/EmptyState';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import type { CategoryScore } from '@/lib/types';

interface RiskHazardsSectionProps {
  category: CategoryScore;
}

export function RiskHazardsSection({ category }: RiskHazardsSectionProps) {
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
      {/* Critical findings first */}
      {critical.length > 0 && (
        <div className="space-y-2">
          {critical.map((indicator) => (
            <div
              key={indicator.name}
              className="border-l-4 border-risk-very-high rounded-lg border border-border p-3 flex items-start gap-2"
            >
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
            <EmptyState
              variant="no-risk"
              title="No significant hazard risks detected"
              description={`${available.length} hazard indicators assessed for this location.`}
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {normal.map((indicator) => (
              <IndicatorCard key={indicator.name} indicator={indicator} />
            ))}
          </div>
        </>
      )}

      {/* Unavailable indicators */}
      {unavailable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {unavailable.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      <DataSourceBadge source="GWRC, GNS, NIWA, Waka Kotahi, MfE" />
    </div>
  );
}
