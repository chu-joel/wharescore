'use client';

import { DollarSign } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

interface Props {
  report: PropertyReport;
}

/**
 * Compact rent affordability snapshot shown at the top of the renter report.
 * Shows median rent for this type + affordability context.
 * Leads the renter story with their #1 concern: money.
 */
export function RentAffordabilitySnap({ report }: Props) {
  const assessment = report.market?.rent_assessment;
  if (!assessment) return null;

  const median = assessment.median;
  const lq = assessment.lower_quartile;
  const uq = assessment.upper_quartile;
  const bedrooms = assessment.bedrooms;
  const type = assessment.dwelling_type;
  const bondCount = assessment.bond_count;

  // Calculate yearly cost
  const yearlyRent = median * 52;
  // NZ median income ~$65k before tax, ~$52k after tax
  const medianTakeHome = 52000;
  const rentPctOfMedianIncome = Math.round((yearlyRent / medianTakeHome) * 100);

  const isExpensive = rentPctOfMedianIncome > 40;
  const isAffordable = rentPctOfMedianIncome <= 30;

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-900/30 shrink-0">
          <DollarSign className="h-4 w-4 text-piq-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums text-piq-primary">
              ${median}
            </span>
            <span className="text-xs text-muted-foreground">/wk median</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {bedrooms}-bed {type?.toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground">
              Range: ${lq}–${uq}/wk
            </span>
            {bondCount > 0 && (
              <span className="text-xs text-muted-foreground">
                Based on {bondCount} recent bonds
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              isAffordable
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                : isExpensive
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
            }`}>
              {formatCurrency(yearlyRent)}/yr — {rentPctOfMedianIncome}% of median NZ take-home pay
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
