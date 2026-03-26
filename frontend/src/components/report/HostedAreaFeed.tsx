'use client';

import { Activity, CloudLightning, Radio, Mountain, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import type { AreaFeedResponse, AreaFeedEvent } from '@/hooks/useAreaFeed';

interface Props {
  feed: AreaFeedResponse;
}

/** Severity → colour classes */
function severityColors(severity: string) {
  switch (severity) {
    case 'critical': return { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
    case 'warning': return { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
    default: return { dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
  }
}

/** Source → icon component */
function SourceIcon({ source, className }: { source: string; className?: string }) {
  switch (source) {
    case 'geonet': return <Activity className={className} />;
    case 'metservice': return <CloudLightning className={className} />;
    case 'nema': return <Radio className={className} />;
    case 'volcano': return <Mountain className={className} />;
    default: return <Info className={className} />;
  }
}

/** Severity → icon */
function SeverityIcon({ severity, className }: { severity: string; className?: string }) {
  switch (severity) {
    case 'critical': return <AlertTriangle className={className} />;
    case 'warning': return <AlertCircle className={className} />;
    default: return <Info className={className} />;
  }
}

/** Format MMI to a descriptive intensity string */
function mmiDescription(mmi: number): string {
  if (mmi <= 1) return 'Not felt';
  if (mmi <= 2) return 'Weak';
  if (mmi <= 3) return 'Weak';
  if (mmi <= 4) return 'Light';
  if (mmi <= 5) return 'Moderate';
  if (mmi <= 6) return 'Strong';
  if (mmi <= 7) return 'Very strong';
  if (mmi <= 8) return 'Severe';
  if (mmi <= 9) return 'Violent';
  return 'Extreme';
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EventCard({ event }: { event: AreaFeedEvent }) {
  const colors = severityColors(event.severity);

  return (
    <div className="relative flex gap-3 pl-6">
      {/* Timeline dot */}
      <div className={`absolute left-0 top-1 h-3 w-3 rounded-full ${colors.dot} ring-2 ring-background`} />

      <div className="flex-1 rounded-lg border border-border bg-card p-3 space-y-1.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <SourceIcon source={event.source} className={`h-4 w-4 shrink-0 ${colors.text}`} />
            <span className="text-sm font-semibold truncate">{event.title}</span>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${colors.badge}`}>
            {event.severity}
          </span>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-xs text-muted-foreground">{event.description}</p>
        )}

        {/* Detail chips */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {event.magnitude != null && (
            <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              M{event.magnitude.toFixed(1)}
            </span>
          )}
          {event.mmi != null && (
            <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              MMI {event.mmi} — {mmiDescription(event.mmi)}
            </span>
          )}
          {event.distance_km != null && (
            <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              {event.distance_km < 1 ? '<1' : event.distance_km.toFixed(0)} km away
            </span>
          )}
          {event.active && (
            <span className="inline-flex items-center rounded bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              ACTIVE
            </span>
          )}
          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {formatDateTime(event.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function HostedAreaFeed({ feed }: Props) {
  const { summary, events } = feed;

  if (summary.total_events === 0) {
    return (
      <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <Activity className="h-5 w-5 text-piq-success" />
          <h3 className="text-lg font-bold">Area Activity & Alerts</h3>
        </div>
        <div className="px-5 pb-5">
          <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/10 p-4 flex items-center gap-3">
            <Info className="h-5 w-5 text-piq-success shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              No significant seismic, weather, or emergency events detected near this property in the past year.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Build summary line
  const parts: string[] = [];
  if (summary.critical > 0) parts.push(`${summary.critical} critical`);
  if (summary.warning > 0) parts.push(`${summary.warning} warning${summary.warning !== 1 ? 's' : ''}`);
  if (summary.info > 0) parts.push(`${summary.info} event${summary.info !== 1 ? 's' : ''}`);
  const summaryLine = parts.join(', ') + ' in the last year';

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Activity className="h-5 w-5 text-amber-600" />
        <h3 className="text-lg font-bold">Area Activity & Alerts</h3>
      </div>

      <div className="px-5 pb-5 space-y-4">
        {/* Summary banner */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 p-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{summaryLine}</p>
          {summary.headline && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{summary.headline}</p>
          )}
        </div>

        {/* Timeline */}
        <div className="relative space-y-3 ml-1.5">
          {/* Vertical line */}
          <div className="absolute left-[5px] top-3 bottom-3 w-px bg-border" />

          {events.map((event, i) => (
            <EventCard key={`${event.source}-${event.timestamp}-${i}`} event={event} />
          ))}
        </div>

        {/* Source attribution */}
        <p className="text-[10px] text-muted-foreground pt-2 border-t border-border">
          Sources: GeoNet (earthquakes & volcanic alerts), MetService (severe weather warnings), NEMA (emergency alerts).
          Events shown are within approximately 100 km of this property.
        </p>
      </div>
    </div>
  );
}
