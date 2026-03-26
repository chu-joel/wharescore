'use client';

import { ShieldAlert, ShieldCheck, Activity, CloudLightning, Radio } from 'lucide-react';
import type { AreaFeedResponse } from '@/hooks/useAreaFeed';

interface Props {
  feed: AreaFeedResponse;
  addressId: number;
}

/** Maps event source to a human-readable category label */
function sourceLabel(source: string): string {
  switch (source) {
    case 'geonet': return 'seismic event';
    case 'metservice': return 'weather warning';
    case 'nema': return 'emergency alert';
    case 'volcano': return 'volcanic alert';
    default: return 'event';
  }
}

function pluralise(count: number, singular: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${singular}s`;
}

export function AreaEventTeaser({ feed, addressId }: Props) {
  const { summary, events } = feed;

  // No events — show a green "all clear" message
  if (summary.total_events === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/10 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-piq-success shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              No recent alerts
            </p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
              No significant seismic, weather, or emergency events detected near this property recently.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Group events by source for the vague summary
  const sourceCounts = events.reduce<Record<string, number>>((acc, evt) => {
    acc[evt.source] = (acc[evt.source] || 0) + 1;
    return acc;
  }, {});

  const sourceLines = Object.entries(sourceCounts).map(
    ([source, count]) => pluralise(count, sourceLabel(source))
  );

  const sourceIcon = (source: string) => {
    switch (source) {
      case 'geonet': return <Activity className="h-3.5 w-3.5" />;
      case 'metservice': return <CloudLightning className="h-3.5 w-3.5" />;
      case 'nema': return <Radio className="h-3.5 w-3.5" />;
      case 'volcano': return <Activity className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {pluralise(summary.total_events, 'significant event')} near this property
          </p>

          <div className="flex flex-wrap gap-2">
            {Object.entries(sourceCounts).map(([source, count]) => (
              <span
                key={source}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
              >
                {sourceIcon(source)}
                {pluralise(count, sourceLabel(source))}
              </span>
            ))}
          </div>

          <p className="text-xs text-amber-700 dark:text-amber-400">
            Get the full report to see event details, distances, and severity levels.
          </p>
        </div>
      </div>
    </div>
  );
}
