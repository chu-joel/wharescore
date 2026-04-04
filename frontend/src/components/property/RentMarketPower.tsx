'use client';

import { TrendingDown, TrendingUp, Minus, Handshake } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface Props {
  report: PropertyReport;
}

/**
 * Rent Market Power indicator for renters.
 * Tells the renter whether they have negotiating leverage.
 * Based on rent trend direction + market heat + bond count.
 */
export function RentMarketPower({ report }: Props) {
  const trend = report.market?.trend;
  const assessment = report.market?.rent_assessment;
  const heat = report.market?.market_heat;

  if (!trend && !heat) return null;

  const cagr1 = trend?.cagr_1yr;
  const bondCount = assessment?.bond_count ?? 0;

  // Determine market power
  let power: 'strong' | 'moderate' | 'weak';
  let headline: string;
  let advice: string;
  let Icon = Minus;

  if (cagr1 !== null && cagr1 !== undefined && cagr1 <= -3) {
    power = 'strong';
    headline = 'Rents are falling here';
    advice = `Rents dropped ${Math.abs(cagr1).toFixed(1)}% this year. You have negotiating power — ask for a lower rent or longer fixed term at current rate.`;
    Icon = TrendingDown;
  } else if (cagr1 !== null && cagr1 !== undefined && cagr1 <= 0) {
    power = 'moderate';
    headline = 'Rents are flat or softening';
    advice = 'Rents haven\'t grown this year. Room to negotiate — especially if the property has been listed for 2+ weeks.';
    Icon = Minus;
  } else if (cagr1 !== null && cagr1 !== undefined && cagr1 <= 3) {
    power = 'moderate';
    headline = 'Rents rising slowly';
    advice = `Rents up ${cagr1.toFixed(1)}% this year — roughly tracking inflation. Less room to negotiate, but still worth asking.`;
    Icon = TrendingUp;
  } else if (cagr1 !== null && cagr1 !== undefined) {
    power = 'weak';
    headline = 'Rents rising fast';
    advice = `Rents up ${cagr1.toFixed(1)}% this year — above inflation. Landlord has more leverage. Lock in a fixed term to avoid increases.`;
    Icon = TrendingUp;
  } else if (heat === 'cold' || heat === 'cool') {
    power = 'strong';
    headline = 'Cool rental market';
    advice = 'More supply than demand in this area. You have options — don\'t feel pressured.';
    Icon = TrendingDown;
  } else if (heat === 'hot' || heat === 'warm') {
    power = 'weak';
    headline = 'Hot rental market';
    advice = 'High demand in this area. Be ready to apply quickly, but don\'t skip your checks.';
    Icon = TrendingUp;
  } else {
    return null;
  }

  const STYLES = {
    strong: { bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-200/60 dark:border-green-900/40', color: 'text-green-700 dark:text-green-400' },
    moderate: { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200/60 dark:border-blue-900/40', color: 'text-blue-700 dark:text-blue-400' },
    weak: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200/60 dark:border-amber-900/40', color: 'text-amber-700 dark:text-amber-400' },
  };

  const style = STYLES[power];

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-3.5`}>
      <div className="flex items-center gap-2.5">
        <Handshake className={`h-5 w-5 ${style.color} shrink-0`} />
        <div>
          <div className="flex items-center gap-2">
            <p className={`text-sm font-bold ${style.color}`}>{headline}</p>
            <Icon className={`h-4 w-4 ${style.color}`} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {advice}
          </p>
          {bondCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {bondCount} recent bonds for similar properties — {bondCount >= 20 ? 'good market data' : bondCount >= 5 ? 'reasonable sample' : 'limited data'}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
