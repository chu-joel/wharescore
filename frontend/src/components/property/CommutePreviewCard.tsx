'use client';

import { Clock, Bus, Plane, Cross, Building2 } from 'lucide-react';
import type { TransitTravelTime } from '@/lib/types';

/** Free-tier teaser: top 3 transit travel times + peak frequency */

interface CommutePreviewCardProps {
  travelTimes: TransitTravelTime[] | null;
  peakTripsPerHour: number | null;
  nearestStopName: string | null;
}

const FREE_DESTINATIONS = 3;

const DEST_ICONS: Record<string, typeof Bus> = {
  'Wellington CBD': Building2,
  'Airport': Plane,
  'Hospital': Cross,
};

export function CommutePreviewCard({
  travelTimes,
  peakTripsPerHour,
  nearestStopName,
}: CommutePreviewCardProps) {
  if (!travelTimes || travelTimes.length === 0) return null;

  const shown = travelTimes.slice(0, FREE_DESTINATIONS);
  const hiddenCount = travelTimes.length - FREE_DESTINATIONS;

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated animate-fade-in-up stagger-3">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30">
          <Clock className="h-4 w-4 text-piq-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Morning commute</p>
          <p className="text-[10px] text-muted-foreground">
            {peakTripsPerHour != null
              ? `~${Math.round(peakTripsPerHour)} services/hr · 7–9 AM`
              : '7–9 AM weekday schedule'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {shown.map((tt) => {
          const Icon = DEST_ICONS[tt.destination] ?? Bus;
          return (
            <div key={tt.destination} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs truncate">{tt.destination}</span>
              </div>
              <span className="text-xs font-bold tabular-nums ml-2 shrink-0">
                {Math.round(tt.minutes)} min
              </span>
            </div>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <p className="text-[10px] text-muted-foreground mt-2.5">
          + {hiddenCount} more destinations in the full report
        </p>
      )}

      {nearestStopName && (
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          From {nearestStopName}
        </p>
      )}
    </div>
  );
}
