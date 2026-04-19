'use client';

import { useState } from 'react';
import {
  Activity, CloudLightning, Radio, Mountain, AlertTriangle, Info, AlertCircle,
  ShieldAlert, ChevronDown, ChevronRight, Wind, Droplets, Waves, Zap,
} from 'lucide-react';
import type { AreaFeedResponse, AreaFeedEvent } from '@/hooks/useAreaFeed';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  feed: AreaFeedResponse | undefined;
  snapshot: ReportSnapshot;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityColors(severity: string) {
  switch (severity) {
    case 'critical': return { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', border: 'border-red-300 dark:border-red-800', bg: 'bg-red-50 dark:bg-red-950/20' };
    case 'warning': return { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-950/20' };
    default: return { dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-900', bg: 'bg-blue-50 dark:bg-blue-950/10' };
  }
}

function adviceSeverityColors(severity: string) {
  switch (severity) {
    case 'high': return { icon: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-900', bg: 'bg-red-50/50 dark:bg-red-950/10' };
    case 'medium': return { icon: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900', bg: 'bg-amber-50/50 dark:bg-amber-950/10' };
    default: return { icon: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-900', bg: 'bg-blue-50/50 dark:bg-blue-950/10' };
  }
}

function SourceIcon({ source, className }: { source: string; className?: string }) {
  switch (source) {
    case 'geonet': return <Activity className={className} />;
    case 'metservice': return <CloudLightning className={className} />;
    case 'nema': return <Radio className={className} />;
    case 'volcano': return <Mountain className={className} />;
    case 'weather_history': return <CloudLightning className={className} />;
    default: return <Info className={className} />;
  }
}

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

function formatDate(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Unknown';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Watch items — derive from report hazard data
// ---------------------------------------------------------------------------

interface WatchItem {
  icon: React.ReactNode;
  color: string;       // tailwind bg class for left stripe
  dotColor: string;    // dot indicator
  label: string;
  description: string;
}

function deriveWatchItems(snapshot: ReportSnapshot): WatchItem[] {
  const report = snapshot.report as Record<string, unknown>;
  const hazards = report.hazards as Record<string, unknown> | undefined;
  if (!hazards) return [];

  const items: WatchItem[] = [];

  // Tsunami zone
  const tsunamiZone = hazards.tsunami_zone as string | null;
  if (tsunamiZone && tsunamiZone !== 'none' && tsunamiZone !== 'None') {
    items.push({
      icon: <Waves className="h-5 w-5" />,
      color: 'bg-red-500',
      dotColor: 'bg-red-500',
      label: `TSUNAMI EVACUATION ZONE`,
      description: `This property is in zone ${tsunamiZone}. In a long or strong earthquake, evacuate to high ground immediately.`,
    });
  }

  // EPB (earthquake-prone building)
  const epbCount = hazards.epb_count as number | null;
  const epbRating = hazards.epb_rating as string | null;
  if ((epbCount && epbCount > 0) || epbRating) {
    items.push({
      icon: <AlertTriangle className="h-5 w-5" />,
      color: 'bg-red-500',
      dotColor: 'bg-red-500',
      label: 'EARTHQUAKE-PRONE BUILDING',
      description: epbRating
        ? `EPB rating: ${epbRating}. Building may require seismic strengthening within deadline.`
        : `${epbCount} earthquake-prone building(s) within 300m of this property.`,
    });
  }

  // Active fault proximity
  const activeFault = hazards.active_fault_nearest as Record<string, unknown> | null;
  if (activeFault && (activeFault.distance_m as number) < 2000) {
    const faultName = activeFault.name as string;
    const faultDist = ((activeFault.distance_m as number) / 1000).toFixed(1);
    items.push({
      icon: <Zap className="h-5 w-5" />,
      color: 'bg-orange-500',
      dotColor: 'bg-orange-500',
      label: 'NEAR ACTIVE FAULT',
      description: faultName
        ? `${faultName} is ${faultDist} km away. Properties near active faults face elevated seismic risk.`
        : `Active fault ${faultDist} km away. Properties near active faults face elevated seismic risk.`,
    });
  }

  // Fault avoidance zone
  const faz = hazards.fault_avoidance_zone;
  if (faz) {
    const fazStr = typeof faz === 'string' ? faz : (faz as Record<string, unknown>)?.zone_type ?? (faz as Record<string, unknown>)?.fault_name ?? 'Active Fault';
    items.push({
      icon: <Zap className="h-5 w-5" />,
      color: 'bg-red-600',
      dotColor: 'bg-red-600',
      label: 'FAULT AVOIDANCE ZONE',
      description: `This property is within a Fault Avoidance Zone (${fazStr}). Building restrictions may apply.`,
    });
  }

  // Flood zone — any of the three flood fields counts (GWRC flood_zones,
  // regional flood extent, or WCC District Plan overlay).
  const floodZone = (hazards.flood_zone
    ?? hazards.flood_extent_label
    ?? hazards.flood_extent_aep
    ?? hazards.wcc_flood_type) as string | null;
  if (floodZone && floodZone !== 'none' && floodZone !== 'None' && floodZone !== 'Low') {
    items.push({
      icon: <Droplets className="h-5 w-5" />,
      color: floodZone.toLowerCase().includes('high') ? 'bg-red-500' : 'bg-amber-500',
      dotColor: floodZone.toLowerCase().includes('high') ? 'bg-red-500' : 'bg-amber-500',
      label: 'FLOOD ZONE',
      description: `This property is in a ${floodZone.toLowerCase()} flood risk area. Check insurance coverage and evacuation routes.`,
    });
  }

  // Liquefaction
  const liqZone = hazards.liquefaction_zone as string | null;
  if (liqZone && liqZone !== 'none' && liqZone !== 'None' && liqZone.toLowerCase() !== 'low') {
    items.push({
      icon: <Mountain className="h-5 w-5" />,
      color: 'bg-amber-500',
      dotColor: 'bg-amber-500',
      label: 'LIQUEFACTION SUSCEPTIBLE',
      description: `Liquefaction susceptibility: ${liqZone}. Ground may become unstable during earthquakes.`,
    });
  }

  // Coastal erosion
  const coastalErosion = hazards.coastal_erosion_exposure as string | null;
  if (coastalErosion && coastalErosion !== 'none' && coastalErosion !== 'None') {
    items.push({
      icon: <Waves className="h-5 w-5" />,
      color: 'bg-amber-500',
      dotColor: 'bg-amber-500',
      label: 'COASTAL EROSION EXPOSURE',
      description: `Coastal erosion exposure: ${coastalErosion}. Long-term shoreline retreat may affect this area.`,
    });
  }

  return items.slice(0, 2); // top 2
}

// ---------------------------------------------------------------------------
// Top events — pick the 3 most notable from feed
// ---------------------------------------------------------------------------

interface TopEvent {
  headline: string;
  subline: string;
  detail: string;
  dateStr: string;
  severity: string;
  icon: React.ReactNode;
}

function pickTopEvents(events: AreaFeedEvent[], weatherHistory: ReportSnapshot['weather_history']): TopEvent[] {
  const tops: TopEvent[] = [];
  // Dedup keys so the same storm/quake can't appear twice across the feed + weather history.
  // Previous behaviour produced pairs like "159km/h wind gusts" (from snapshot) and a near-
  // identical NEMA/MetService feed entry next to it. Keying on headline + date filters that out.
  const seen = new Set<string>();
  const pushIfFresh = (ev: TopEvent) => {
    if (!ev.dateStr || ev.dateStr === 'Unknown') return;
    const key = `${ev.headline}|${ev.dateStr}`;
    if (seen.has(key)) return;
    seen.add(key);
    tops.push(ev);
  };

  // Sort feed events by severity then date
  const sorted = [...events].sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 };
    const sa = sev[a.severity] ?? 2;
    const sb = sev[b.severity] ?? 2;
    if (sa !== sb) return sa - sb;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Find biggest earthquake
  const quake = sorted.find(e => e.magnitude != null);
  if (quake) {
    pushIfFresh({
      headline: `M${quake.magnitude!.toFixed(1)}`,
      subline: 'quake',
      detail: quake.distance_km != null ? `${quake.distance_km < 1 ? '<1' : quake.distance_km.toFixed(0)}km` : '',
      dateStr: formatDate(quake.timestamp),
      severity: quake.severity,
      icon: <Activity className="h-5 w-5" />,
    });
  }

  // Find worst weather from snapshot weather_history
  if (weatherHistory?.length) {
    const rain = [...weatherHistory].sort((a, b) => (b.precipitation_mm ?? 0) - (a.precipitation_mm ?? 0))[0];
    if (rain?.precipitation_mm && rain.precipitation_mm > 0) {
      pushIfFresh({
        headline: `${rain.precipitation_mm.toFixed(0)}mm`,
        subline: rain.severity ? `${rain.severity} rain` : 'rainfall',
        detail: rain.title || '',
        dateStr: formatDate(rain.date),
        severity: rain.severity === 'extreme' || rain.severity === 'critical' ? 'critical' : rain.severity === 'warning' ? 'warning' : 'info',
        icon: <Droplets className="h-5 w-5" />,
      });
    }

    const wind = [...weatherHistory].sort((a, b) => (b.wind_gust_kmh ?? 0) - (a.wind_gust_kmh ?? 0))[0];
    if (wind?.wind_gust_kmh && wind.wind_gust_kmh > 0 && wind !== rain) {
      pushIfFresh({
        headline: `${wind.wind_gust_kmh.toFixed(0)}km/h`,
        subline: 'wind gusts',
        detail: wind.title || '',
        dateStr: formatDate(wind.date),
        severity: wind.wind_gust_kmh >= 100 ? 'critical' : wind.wind_gust_kmh >= 70 ? 'warning' : 'info',
        icon: <Wind className="h-5 w-5" />,
      });
    }
  }

  // Fill remaining from sorted feed events (not already represented)
  for (const evt of sorted) {
    if (tops.length >= 3) break;
    if (evt.magnitude != null && quake) continue; // already have quake
    pushIfFresh({
      headline: evt.title.split(' ')[0] || evt.type,
      subline: evt.title,
      detail: evt.distance_km != null ? `${evt.distance_km.toFixed(0)}km` : '',
      dateStr: formatDate(evt.timestamp),
      severity: evt.severity,
      icon: <SourceIcon source={evt.source} className="h-5 w-5" />,
    });
  }

  return tops.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WatchCard({ item }: { item: WatchItem }) {
  return (
    <div className={`relative rounded-lg border-2 ${item.color === 'bg-red-500' || item.color === 'bg-red-600' ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20' : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'} p-4 overflow-hidden`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.color}`} />
      <div className="flex items-start gap-3 pl-2">
        <div className={`shrink-0 mt-0.5 ${item.color === 'bg-red-500' || item.color === 'bg-red-600' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {item.icon}
        </div>
        <div className="min-w-0">
          <p className={`text-xs font-black tracking-wider uppercase ${item.color === 'bg-red-500' || item.color === 'bg-red-600' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {item.label}
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
        </div>
      </div>
    </div>
  );
}

function TopEventCard({ event }: { event: TopEvent }) {
  const colors = severityColors(event.severity);
  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 text-center space-y-1 overflow-hidden`}>
      <div className={`mx-auto ${colors.text}`}>{event.icon}</div>
      <p className={`text-xl font-black tabular-nums ${colors.text} break-words`}>{event.headline}</p>
      <p className="text-xs font-semibold text-foreground">{event.subline}</p>
      {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
      <p className="text-xs text-muted-foreground">{event.dateStr}</p>
    </div>
  );
}

function AdviceSection({ advice }: { advice: NonNullable<ReportSnapshot['hazard_advice']>[number] }) {
  const [open, setOpen] = useState(true);
  const colors = adviceSeverityColors(advice.severity);

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <ShieldAlert className={`h-4 w-4 shrink-0 ${colors.icon}`} />
        <span className="text-sm font-semibold flex-1">{advice.title}</span>
        <span className="text-xs text-muted-foreground shrink-0">{advice.source}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 space-y-2">
          <ul className="space-y-1.5">
            {advice.actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground leading-relaxed">
                <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-current opacity-40" />
                {action}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground italic">Source: {advice.source}</p>
        </div>
      )}
    </div>
  );
}

function TimelineEvent({ event }: { event: AreaFeedEvent }) {
  const colors = severityColors(event.severity);
  return (
    <div className="relative flex gap-3 pl-6">
      <div className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${colors.dot} ring-2 ring-background`} />
      <div className="flex-1 py-1">
        <div className="flex items-center gap-2">
          <SourceIcon source={event.source} className={`h-3.5 w-3.5 shrink-0 ${colors.text}`} />
          <span className="text-xs font-medium truncate">{event.title}</span>
          <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${colors.badge}`}>
            {event.severity}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {event.magnitude != null && (
            <span className="text-xs text-muted-foreground">M{event.magnitude.toFixed(1)}</span>
          )}
          {event.mmi != null && (
            <span className="text-xs text-muted-foreground">MMI {event.mmi} ({mmiDescription(event.mmi)})</span>
          )}
          {event.distance_km != null && (
            <span className="text-xs text-muted-foreground">{event.distance_km < 1 ? '<1' : event.distance_km.toFixed(0)}km</span>
          )}
          <span className="text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function WeatherTimelineEvent({ event }: { event: NonNullable<ReportSnapshot['weather_history']>[number] }) {
  const colors = severityColors(event.severity === 'extreme' || event.severity === 'critical' ? 'critical' : event.severity === 'warning' ? 'warning' : 'info');
  return (
    <div className="relative flex gap-3 pl-6">
      <div className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${colors.dot} ring-2 ring-background`} />
      <div className="flex-1 py-1">
        <div className="flex items-center gap-2">
          <CloudLightning className={`h-3.5 w-3.5 shrink-0 ${colors.text}`} />
          <span className="text-xs font-medium truncate">{event.title}</span>
          <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${colors.badge}`}>
            {event.severity}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {event.precipitation_mm != null && event.precipitation_mm > 0 && (
            <span className="text-xs text-muted-foreground">{event.precipitation_mm.toFixed(0)}mm rain</span>
          )}
          {event.wind_gust_kmh != null && event.wind_gust_kmh > 0 && (
            <span className="text-xs text-muted-foreground">{event.wind_gust_kmh.toFixed(0)}km/h gusts</span>
          )}
          {event.distance_km != null && (
            <span className="text-xs text-muted-foreground">{event.distance_km.toFixed(0)}km</span>
          )}
          <span className="text-xs text-muted-foreground">{formatDate(event.date)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable Timeline — shows important events, accordion for rest
// ---------------------------------------------------------------------------

type TimelineItem =
  | { kind: 'feed'; event: AreaFeedEvent; date: Date }
  | { kind: 'weather'; event: NonNullable<ReportSnapshot['weather_history']>[number]; date: Date };

function ExpandableTimeline({ timeline }: { timeline: TimelineItem[] }) {
  const [sectionOpen, setSectionOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Split into important (critical/warning) and rest
  const important = timeline.filter(item => {
    if (item.kind === 'feed') return item.event.severity === 'critical' || item.event.severity === 'warning';
    return item.event.severity === 'critical' || item.event.severity === 'warning' || item.event.severity === 'extreme';
  });
  const rest = timeline.filter(item => !important.includes(item));
  const shown = important.length > 0 ? important : timeline.slice(0, 3);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setSectionOpen(!sectionOpen)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        {sectionOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Event Timeline <span className="font-normal">({timeline.length} total)</span>
        </p>
      </button>

      {sectionOpen && (
        <>
          <div className="relative space-y-1 ml-1.5">
            <div className="absolute left-[4px] top-2 bottom-2 w-px bg-border" />
            {shown.map((item, i) =>
              item.kind === 'feed'
                ? <TimelineEvent key={`f-${i}`} event={item.event} />
                : <WeatherTimelineEvent key={`w-${i}`} event={item.event} />,
            )}
          </div>

          {rest.length > 0 && (
            <>
              {expanded && (
                <div className="relative space-y-1 ml-1.5">
                  <div className="absolute left-[4px] top-2 bottom-2 w-px bg-border" />
                  {rest.map((item, i) =>
                    item.kind === 'feed'
                      ? <TimelineEvent key={`fr-${i}`} event={item.event} />
                      : <WeatherTimelineEvent key={`wr-${i}`} event={item.event} />,
                  )}
                </div>
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 text-xs font-medium text-piq-primary hover:text-piq-primary/80 transition-colors ml-1.5"
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {expanded ? 'Show less' : `Show all ${timeline.length} events`}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HostedAreaFeed({ feed, snapshot }: Props) {
  const watchItems = deriveWatchItems(snapshot);
  const feedEvents = feed?.events ?? [];
  const weatherHistory = snapshot.weather_history ?? [];
  const hazardAdvice = snapshot.hazard_advice ?? [];
  const topEvents = pickTopEvents(feedEvents, snapshot.weather_history);

  // Merge feed + weather into unified timeline, sorted by date descending
  const timeline: TimelineItem[] = [
    ...feedEvents.map(e => ({ kind: 'feed' as const, event: e, date: new Date(e.timestamp) })),
    ...weatherHistory.map(e => ({ kind: 'weather' as const, event: e, date: new Date(e.date) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const hasContent = watchItems.length > 0 || topEvents.length > 0 || hazardAdvice.length > 0 || timeline.length > 0;

  if (!hasContent) {
    return (
      <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-piq-success" />
          <h3 className="text-lg font-bold">Hazard Intelligence</h3>
        </div>
        <div className="px-5 pb-5">
          <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/10 p-4 flex items-center gap-3">
            <Info className="h-5 w-5 text-piq-success shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              No significant hazard zones, seismic events, or severe weather detected for this property in the past year.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-amber-600" />
        <h3 className="text-lg font-bold">Hazard Intelligence</h3>
      </div>

      <div className="px-5 pb-5 space-y-5">

        {/* ═══ WATCH ITEMS — permanent hazard context ═══ */}
        {watchItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Watches</p>
            <div className="grid gap-2">
              {watchItems.map((item, i) => (
                <WatchCard key={i} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* ═══ TOP EVENTS — 3 most notable ═══ */}
        {topEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Events</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {topEvents.map((evt, i) => (
                <TopEventCard key={i} event={evt} />
              ))}
            </div>
          </div>
        )}

        {/* ═══ HAZARD ADVICE — collapsible ═══ */}
        {hazardAdvice.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preparedness Advice</p>
            <div className="space-y-2">
              {hazardAdvice.map((advice, i) => (
                <AdviceSection key={i} advice={advice} />
              ))}
            </div>
          </div>
        )}

        {/* ═══ TIMELINE — important events shown, rest expandable ═══ */}
        {timeline.length > 0 && (
          <ExpandableTimeline timeline={timeline} />
        )}

        {/* Source attribution */}
        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          Sources: GeoNet (earthquakes & volcanic alerts), MetService (severe weather), NEMA (emergency alerts), council hazard maps.
          Events shown are within approximately 100km of this property.
        </p>
      </div>
    </div>
  );
}
