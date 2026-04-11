'use client';

import { CheckCircle2, AlertTriangle, Eye, Landmark, Leaf, Users } from 'lucide-react';
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

  // Collect active overlays for the overlay section
  const overlays: { icon: typeof Eye; label: string; detail: string; color: string }[] = [];
  if (planning.in_viewshaft && planning.viewshaft_name) {
    overlays.push({
      icon: Eye,
      label: 'Viewshaft Protection',
      detail: planning.viewshaft_name + (planning.viewshaft_significance ? ` (${planning.viewshaft_significance})` : ''),
      color: 'text-purple-600 dark:text-purple-400',
    });
  }
  if (planning.in_character_precinct && planning.character_precinct_name) {
    overlays.push({
      icon: Landmark,
      label: 'Character Precinct',
      detail: planning.character_precinct_name,
      color: 'text-amber-600 dark:text-amber-400',
    });
  }
  if (planning.in_special_character_area && planning.special_character_name) {
    overlays.push({
      icon: Landmark,
      label: 'Special Character Area',
      detail: planning.special_character_name,
      color: 'text-amber-600 dark:text-amber-400',
    });
  }
  if (planning.in_heritage_overlay && planning.heritage_overlay_name) {
    overlays.push({
      icon: Landmark,
      label: `Heritage Overlay${planning.heritage_overlay_type ? ` (${planning.heritage_overlay_type})` : ''}`,
      detail: planning.heritage_overlay_name,
      color: 'text-orange-600 dark:text-orange-400',
    });
  }
  if (planning.in_ecological_area) {
    overlays.push({
      icon: Leaf,
      label: 'Significant Ecological Area',
      detail: planning.ecological_area_name
        ? `${planning.ecological_area_name}${planning.ecological_area_type ? ` (${planning.ecological_area_type})` : ''}`
        : 'Ecological protection applies',
      color: 'text-green-600 dark:text-green-400',
    });
  }
  if (planning.in_mana_whenua && planning.mana_whenua_name) {
    overlays.push({
      icon: Users,
      label: 'Mana Whenua Area',
      detail: planning.mana_whenua_name,
      color: 'text-teal-600 dark:text-teal-400',
    });
  }

  return (
    <div className="space-y-3">
      {/* Zone info */}
      {planning.zone_name && (
        <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
          <span className="text-sm font-semibold">District Plan Zone</span>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Zone</span>
              <Badge variant="secondary">{planning.zone_name}</Badge>
            </div>
            {planning.zone_category
              && planning.zone_category !== planning.zone_name
              && !/^zone$/i.test(planning.zone_category.trim())
              && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium text-xs">{planning.zone_category}</span>
              </div>
            )}
            {planning.zone_code && planning.zone_code !== planning.zone_name && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Zone code</span>
                <span className="text-xs font-mono text-muted-foreground">{planning.zone_code}</span>
              </div>
            )}
            {planning.height_limit && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Height limit</span>
                <span className="font-semibold tabular-nums">{planning.height_limit}m</span>
              </div>
            )}
            {planning.height_variation_limit && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Height variation</span>
                <span className="font-medium text-xs">{planning.height_variation_limit}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlays — viewshafts, character precincts, heritage overlay, ecological, mana whenua */}
      {overlays.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3.5 card-elevated space-y-2.5">
          <span className="text-sm font-semibold">Planning Overlays</span>
          {overlays.map((overlay) => {
            const Icon = overlay.icon;
            return (
              <div key={overlay.label} className="flex items-start gap-2.5 text-sm">
                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${overlay.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{overlay.label}</p>
                  <p className="text-xs text-muted-foreground">{overlay.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Heritage / Contamination / EPB / Trees checklist */}
      <div className="rounded-xl border border-border bg-card p-3.5 card-elevated space-y-2">
        <span className="text-sm font-semibold">Checklist</span>
        {/* EPB listed — critical flag */}
        <EpbListedItem listed={planning.epb_listed} />
        <ChecklistItem
          label="Heritage sites nearby"
          count={planning.heritage_count}
          threshold={0}
        />
        <ChecklistItem
          label="Protected trees within 50m"
          count={planning.notable_tree_count_50m}
          threshold={0}
        />
        {planning.notable_tree_nearest && planning.notable_tree_count_50m != null && planning.notable_tree_count_50m > 0 && (
          <p className="text-xs text-muted-foreground pl-7 ml-1">
            Nearest: {planning.notable_tree_nearest}
          </p>
        )}
        <ChecklistItem
          label="Contaminated sites nearby"
          count={planning.contamination_count}
          threshold={0}
        />
        <ChecklistItem
          label="Infrastructure projects (5km)"
          count={planning.infrastructure_count}
          threshold={0}
          positive
        />
        <ChecklistItem
          label="Resource consents (500m, 2yr)"
          count={planning.consent_count}
          threshold={0}
          positive
        />
        {/* Parks */}
        {planning.park_count_500m != null && planning.park_count_500m > 0 && (
          <div className="flex items-center gap-2.5 text-sm">
            <CheckCircle2 className="h-4 w-4 text-piq-success shrink-0" />
            <span>Parks within 500m</span>
            <span className="ml-auto font-medium tabular-nums">{planning.park_count_500m}</span>
          </div>
        )}
        {planning.nearest_park_name && planning.nearest_park_distance_m != null && (
          <p className="text-xs text-muted-foreground pl-7 ml-1">
            Nearest: {planning.nearest_park_name} ({Math.round(planning.nearest_park_distance_m)}m)
          </p>
        )}
      </div>

      {/* Indicator cards */}
      {available.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {available.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      {unavailable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
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

      <DataSourceBadge source="Council District Plans, Heritage NZ, Regional Councils, Te Waihanga" />
    </div>
  );
}

function EpbListedItem({ listed }: { listed: boolean | null }) {
  if (listed === null || listed === undefined) return null;

  return (
    <div className="flex items-center gap-2.5 text-sm">
      {listed ? (
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-piq-success shrink-0" />
      )}
      <span className={listed ? 'font-semibold text-red-700 dark:text-red-400' : ''}>
        This building on the EPB register?
      </span>
      <span className="ml-auto text-xs font-medium">
        {listed ? 'Yes — listed' : 'No'}
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
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
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
    <div className="flex items-center gap-2.5 text-sm">
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
