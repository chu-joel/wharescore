'use client';

import { Users, Car, Maximize2, Bath } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { resolveFloorArea } from '@/lib/format';

interface Props {
  report: PropertyReport;
}

/**
 * Flatmate-friendliness indicator for renters.
 * Reframes existing property data (bedrooms, size, multi-unit, parking)
 * into a quick shared-living suitability assessment.
 */
export function FlatmateFriendly({ report }: Props) {
  const bedrooms = report.property_detection?.detected_bedrooms;
  const isMultiUnit = report.property_detection?.is_multi_unit;
  // Per-unit valued floor area when the council rates API returns it; null for
  // cross-lease / multi-unit where we only have the shared LINZ footprint.
  // Using the shared footprint would inflate the "m² per room" figure for
  // cross-lease units and mislead renters.
  const floor = resolveFloorArea(report.property, {
    isMultiUnit: !!isMultiUnit,
    titleType: report.property.title_type,
  });
  const buildingArea = floor?.isPerUnit ? floor.value : null;
  const detectedType = report.property_detection?.detected_type;

  // Only show for 2+ bedroom properties
  if (!bedrooms || bedrooms < 2) return null;

  const traits: { icon: typeof Users; label: string; good: boolean }[] = [];

  // Bedrooms
  if (bedrooms >= 4) {
    traits.push({ icon: Users, label: `${bedrooms} bedrooms. great for a flat`, good: true });
  } else if (bedrooms >= 3) {
    traits.push({ icon: Users, label: `${bedrooms} bedrooms. suits 2-3 flatmates`, good: true });
  } else {
    traits.push({ icon: Users, label: `${bedrooms} bedrooms. suits a couple or 1 flatmate`, good: true });
  }

  // Size per person
  if (buildingArea && bedrooms >= 2) {
    const sqmPerPerson = buildingArea / bedrooms;
    if (sqmPerPerson >= 25) {
      traits.push({ icon: Maximize2, label: `${Math.round(sqmPerPerson)}m² per room. spacious`, good: true });
    } else if (sqmPerPerson < 15) {
      traits.push({ icon: Maximize2, label: `${Math.round(sqmPerPerson)}m² per room. compact`, good: false });
    }
  }

  // Multi-unit / standalone
  if (detectedType === 'house' && !isMultiUnit) {
    traits.push({ icon: Car, label: 'Standalone house. more privacy, likely parking', good: true });
  } else if (isMultiUnit) {
    traits.push({ icon: Car, label: 'Multi-unit. check parking and shared areas', good: false });
  }

  if (traits.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-4 w-4 text-piq-primary" />
        <span className="text-sm font-semibold">Flatmate-friendly?</span>
      </div>
      <div className="space-y-1.5">
        {traits.map((trait) => {
          const Icon = trait.icon;
          return (
            <div key={trait.label} className="flex items-center gap-2 text-xs">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${trait.good ? 'bg-piq-success' : 'bg-amber-400'}`} />
              <span className="text-muted-foreground">{trait.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
