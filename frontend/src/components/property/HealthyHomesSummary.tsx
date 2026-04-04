'use client';

import { AlertTriangle, CheckCircle, Home } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface Props {
  report: PropertyReport;
}

/**
 * Compact Healthy Homes summary for the free on-screen report (renters only).
 * Shows a traffic-light indicator based on hazard data that affects
 * Healthy Homes compliance (moisture from flood/liquefaction, draught from wind).
 */
export function HealthyHomesSummary({ report }: Props) {
  const hazards = report.hazards;
  const environment = report.environment;

  const windZone = String(environment?.wind_zone || '').toUpperCase();
  const hasFlood = !!(hazards?.flood_zone || hazards?.flood_extent_label);
  const highLiquefaction = String(hazards?.liquefaction_zone || '').toLowerCase().includes('high');
  const coastalErosion = !!(hazards?.coastal_erosion_exposure);
  const highWind = windZone === 'H' || windZone === 'VH' || windZone === 'HIGH' || windZone === 'VERY HIGH' || windZone === 'EH' || windZone === 'SED';

  const flags: string[] = [];
  if (hasFlood || highLiquefaction || coastalErosion) flags.push('moisture risk');
  if (highWind) flags.push('draught risk');

  const flagCount = flags.length;
  const total = 5; // 5 Healthy Homes standards

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
          <Home className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Healthy Homes Check</span>
            {flagCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {flagCount} of {total} flagged
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                <CheckCircle className="h-3 w-3" />
                No hazard flags
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {flagCount > 0
              ? `Environmental factors may affect ${flags.join(' and ')}. Ask the landlord about compliance.`
              : 'No environmental hazards flagged — still ask to see the compliance statement.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
