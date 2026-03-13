'use client';

import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { IndicatorCard } from '@/components/common/IndicatorCard';
import { EmptyState } from '@/components/common/EmptyState';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import type { CategoryScore, PlanningData } from '@/lib/types';

interface PlanningSectionProps {
  category: CategoryScore;
  planning: PlanningData;
}

export function PlanningSection({ category, planning }: PlanningSectionProps) {
  const available = category.indicators.filter((i) => i.is_available);
  const unavailable = category.indicators.filter((i) => !i.is_available);

  return (
    <div className="space-y-3">
      {/* Zone info */}
      {planning.zone_name && (
        <div className="rounded-lg border border-border p-3">
          <span className="text-sm font-semibold">District Plan Zone</span>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Zone</span>
              <Badge variant="secondary">{planning.zone_name}</Badge>
            </div>
            {planning.height_limit && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Height limit</span>
                <span className="font-semibold tabular-nums">{planning.height_limit}m</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Heritage / Contamination / EPB checklist */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <span className="text-sm font-semibold">Checklist</span>
        {/* EPB listed — critical flag */}
        <EpbListedItem listed={planning.epb_listed} />
        <ChecklistItem
          label="Heritage sites nearby"
          count={planning.heritage_count}
          threshold={0}
        />
        <ChecklistItem
          label="Contaminated sites nearby"
          count={planning.contamination_count}
          threshold={0}
        />
        <ChecklistItem
          label="Infrastructure projects nearby"
          count={planning.infrastructure_count}
          threshold={0}
          positive
        />
        <ChecklistItem
          label="Resource consents nearby"
          count={planning.consent_count}
          threshold={0}
          positive
        />
      </div>

      {/* Indicator cards */}
      {available.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {available.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      {unavailable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {unavailable.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      {!planning.zone_name && available.length === 0 && (
        <EmptyState
          variant="no-data"
          title="No planning data available"
          description="Planning data is not yet available for this location."
        />
      )}

      <DataSourceBadge source="WCC District Plan, Heritage NZ, GWRC, Te Waihanga" />
    </div>
  );
}

function EpbListedItem({ listed }: { listed: boolean | null }) {
  if (listed === null || listed === undefined) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {listed ? (
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-piq-success shrink-0" />
      )}
      <span className={listed ? 'font-semibold text-red-700 dark:text-red-400' : ''}>
        Earthquake-prone building
      </span>
      <span className="ml-auto text-xs font-medium">
        {listed ? 'Listed' : 'Not listed'}
      </span>
    </div>
  );
}

function ChecklistItem({
  label,
  count,
  threshold,
  positive = false,
}: {
  label: string;
  count: number | null | undefined;
  threshold: number;
  positive?: boolean;
}) {
  if (count === null || count === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-4 w-4 rounded-full bg-muted" />
        <span>{label}</span>
        <span className="ml-auto text-xs">No data</span>
      </div>
    );
  }

  const hasSome = count > threshold;
  // For hazards (not positive), having items is a warning. For positive items, having items is good.
  const isGood = positive ? hasSome : !hasSome;

  return (
    <div className="flex items-center gap-2 text-sm">
      {isGood ? (
        <CheckCircle2 className="h-4 w-4 text-piq-success shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
      )}
      <span>{label}</span>
      <span className="ml-auto font-medium tabular-nums">{count}</span>
    </div>
  );
}
