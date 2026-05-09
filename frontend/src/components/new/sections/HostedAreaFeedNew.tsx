'use client';

import { useState } from 'react';
import {
  Activity, CloudLightning, Radio, Mountain, AlertTriangle, Info,
  ShieldAlert, ChevronDown, ChevronRight, Wind, Droplets, Waves, Zap,
} from 'lucide-react';
import type { AreaFeedResponse, AreaFeedEvent } from '@/hooks/useAreaFeed';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface Props {
  feed: AreaFeedResponse | undefined;
  snapshot: ReportSnapshot;
}

type Sev = 'critical' | 'warning' | 'info';
const SEV: Record<Sev, { fg: string; bg: string; border: string; dot: string }> = {
  critical: { fg: 'var(--ws-r-vhigh)', bg: 'rgba(196,45,45,.06)', border: 'rgba(196,45,45,.40)', dot: 'var(--ws-r-vhigh)' },
  warning:  { fg: 'var(--ws-r-high)',  bg: 'rgba(213,94,0,.06)',  border: 'rgba(213,94,0,.40)',  dot: 'var(--ws-r-high)'  },
  info:     { fg: 'var(--ws-piq)',     bg: 'rgba(13,115,119,.05)',border: 'rgba(13,115,119,.30)',dot: 'var(--ws-piq)'     },
};

const ADV_SEV: Record<string, { icon: string; bg: string; border: string }> = {
  high:   { icon: 'var(--ws-r-vhigh)', bg: 'rgba(196,45,45,.05)', border: 'rgba(196,45,45,.30)' },
  medium: { icon: 'var(--ws-r-high)',  bg: 'rgba(213,94,0,.05)',  border: 'rgba(213,94,0,.30)'  },
  low:    { icon: 'var(--ws-piq)',     bg: 'rgba(13,115,119,.04)',border: 'rgba(13,115,119,.20)' },
};

function asSev(s: string): Sev {
  if (s === 'extreme' || s === 'critical') return 'critical';
  if (s === 'warning') return 'warning';
  return 'info';
}

function SourceIcon({ source, size = 14 }: { source: string; size?: number }) {
  switch (source) {
    case 'geonet': return <Activity size={size} />;
    case 'metservice': return <CloudLightning size={size} />;
    case 'nema': return <Radio size={size} />;
    case 'volcano': return <Mountain size={size} />;
    case 'weather_history': return <CloudLightning size={size} />;
    default: return <Info size={size} />;
  }
}

function mmiDescription(mmi: number): string {
  if (mmi <= 1) return 'Not felt';
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
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface WatchItem {
  icon: React.ReactNode;
  tone: 'critical' | 'warning';
  label: string;
  description: string;
}

function deriveWatchItems(snapshot: ReportSnapshot): WatchItem[] {
  const report = snapshot.report as Record<string, unknown>;
  const hazards = report.hazards as Record<string, unknown> | undefined;
  if (!hazards) return [];
  const items: WatchItem[] = [];

  const tsunamiZone = hazards.tsunami_zone as string | null;
  if (tsunamiZone && tsunamiZone !== 'none' && tsunamiZone !== 'None') {
    items.push({
      icon: <Waves size={20} />, tone: 'critical',
      label: 'TSUNAMI EVACUATION ZONE',
      description: `This property is in zone ${tsunamiZone}. In a long or strong earthquake, evacuate to high ground immediately.`,
    });
  }

  const epbCount = hazards.epb_count as number | null;
  const epbRating = hazards.epb_rating as string | null;
  if ((epbCount && epbCount > 0) || epbRating) {
    items.push({
      icon: <AlertTriangle size={20} />, tone: 'critical',
      label: 'EARTHQUAKE-PRONE BUILDING',
      description: epbRating
        ? `EPB rating: ${epbRating}. Building may require seismic strengthening within deadline.`
        : `${epbCount} earthquake-prone building(s) within 300m of this property.`,
    });
  }

  const activeFault = hazards.active_fault_nearest as Record<string, unknown> | null;
  if (activeFault && (activeFault.distance_m as number) < 2000) {
    const faultName = activeFault.name as string;
    const faultDist = ((activeFault.distance_m as number) / 1000).toFixed(1);
    items.push({
      icon: <Zap size={20} />, tone: 'warning',
      label: 'NEAR ACTIVE FAULT',
      description: faultName
        ? `${faultName} is ${faultDist} km away. Properties near active faults face elevated seismic risk.`
        : `Active fault ${faultDist} km away. Properties near active faults face elevated seismic risk.`,
    });
  }

  const faz = hazards.fault_avoidance_zone;
  if (faz) {
    const fazStr = typeof faz === 'string' ? faz : (faz as Record<string, unknown>)?.zone_type ?? (faz as Record<string, unknown>)?.fault_name ?? 'Active Fault';
    items.push({
      icon: <Zap size={20} />, tone: 'critical',
      label: 'FAULT AVOIDANCE ZONE',
      description: `This property is within a Fault Avoidance Zone (${fazStr}). Building restrictions may apply.`,
    });
  }

  const floodZone = (hazards.flood_zone
    ?? hazards.flood_extent_label
    ?? hazards.flood_extent_aep
    ?? hazards.wcc_flood_type) as string | null;
  if (floodZone && floodZone !== 'none' && floodZone !== 'None' && floodZone !== 'Low') {
    const isHigh = floodZone.toLowerCase().includes('high');
    items.push({
      icon: <Droplets size={20} />, tone: isHigh ? 'critical' : 'warning',
      label: 'FLOOD ZONE',
      description: `This property is in a ${floodZone.toLowerCase()} flood risk area. Check insurance coverage and evacuation routes.`,
    });
  }

  const liqZone = hazards.liquefaction_zone as string | null;
  if (liqZone && liqZone !== 'none' && liqZone !== 'None' && liqZone.toLowerCase() !== 'low') {
    items.push({
      icon: <Mountain size={20} />, tone: 'warning',
      label: 'LIQUEFACTION SUSCEPTIBLE',
      description: `Liquefaction susceptibility: ${liqZone}. Ground may become unstable during earthquakes.`,
    });
  }

  const coastalErosion = hazards.coastal_erosion_exposure as string | null;
  if (coastalErosion && coastalErosion !== 'none' && coastalErosion !== 'None') {
    items.push({
      icon: <Waves size={20} />, tone: 'warning',
      label: 'COASTAL EROSION EXPOSURE',
      description: `Coastal erosion exposure: ${coastalErosion}. Long-term shoreline retreat may affect this area.`,
    });
  }

  return items.slice(0, 2);
}

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
  const seen = new Set<string>();
  const pushIfFresh = (ev: TopEvent) => {
    if (!ev.dateStr || ev.dateStr === 'Unknown') return;
    const key = `${ev.headline}|${ev.dateStr}`;
    if (seen.has(key)) return;
    seen.add(key);
    tops.push(ev);
  };

  const sorted = [...events].sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 };
    const sa = sev[a.severity] ?? 2;
    const sb = sev[b.severity] ?? 2;
    if (sa !== sb) return sa - sb;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const quake = sorted.find(e => e.magnitude != null);
  if (quake) {
    pushIfFresh({
      headline: `M${quake.magnitude!.toFixed(1)}`,
      subline: 'quake',
      detail: quake.distance_km != null ? `${quake.distance_km < 1 ? '<1' : quake.distance_km.toFixed(0)}km` : '',
      dateStr: formatDate(quake.timestamp),
      severity: quake.severity,
      icon: <Activity size={20} />,
    });
  }

  if (weatherHistory?.length) {
    const rain = [...weatherHistory].sort((a, b) => (b.precipitation_mm ?? 0) - (a.precipitation_mm ?? 0))[0];
    if (rain?.precipitation_mm && rain.precipitation_mm > 0) {
      pushIfFresh({
        headline: `${rain.precipitation_mm.toFixed(0)}mm`,
        subline: rain.severity ? `${rain.severity} rain` : 'rainfall',
        detail: rain.title || '',
        dateStr: formatDate(rain.date),
        severity: rain.severity === 'extreme' || rain.severity === 'critical' ? 'critical' : rain.severity === 'warning' ? 'warning' : 'info',
        icon: <Droplets size={20} />,
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
        icon: <Wind size={20} />,
      });
    }
  }

  for (const evt of sorted) {
    if (tops.length >= 3) break;
    if (evt.magnitude != null && quake) continue;
    pushIfFresh({
      headline: evt.title.split(' ')[0] || evt.type,
      subline: evt.title,
      detail: evt.distance_km != null ? `${evt.distance_km.toFixed(0)}km` : '',
      dateStr: formatDate(evt.timestamp),
      severity: evt.severity,
      icon: <SourceIcon source={evt.source} size={20} />,
    });
  }

  return tops.slice(0, 3);
}

function WatchCard({ item }: { item: WatchItem }) {
  const s = SEV[item.tone];
  return (
    <div style={{
      position: 'relative',
      borderRadius: 'var(--ws-radius-sm)',
      border: `2px solid ${s.border}`,
      background: s.bg,
      padding: 14, paddingLeft: 16,
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: s.dot }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingLeft: 6 }}>
        <div style={{ flexShrink: 0, marginTop: 2, color: s.fg }}>{item.icon}</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: s.fg }}>
            {item.label}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>{item.description}</p>
        </div>
      </div>
    </div>
  );
}

function TopEventCard({ event }: { event: TopEvent }) {
  const s = SEV[asSev(event.severity)];
  return (
    <div style={{
      borderRadius: 'var(--ws-radius-sm)',
      border: `1px solid ${s.border}`,
      background: s.bg,
      padding: 12, textAlign: 'center',
      display: 'grid', gap: 4,
      overflow: 'hidden',
    }}>
      <div style={{ color: s.fg, margin: '0 auto' }}>{event.icon}</div>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: s.fg, wordBreak: 'break-word' }}>
        {event.headline}
      </p>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--ws-ink)' }}>{event.subline}</p>
      {event.detail && <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>{event.detail}</p>}
      <p style={{ margin: 0, fontSize: 11, color: 'var(--ws-ink-mute)' }}>{event.dateStr}</p>
    </div>
  );
}

function AdviceSection({ advice }: { advice: NonNullable<ReportSnapshot['hazard_advice']>[number] }) {
  const [open, setOpen] = useState(true);
  const c = ADV_SEV[advice.severity] ?? ADV_SEV.low;
  return (
    <div style={{
      borderRadius: 'var(--ws-radius-sm)',
      border: `1px solid ${c.border}`,
      background: c.bg,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 14px', textAlign: 'left',
          background: 'transparent', border: 0, cursor: 'pointer', minHeight: 44,
        }}
      >
        {open ? <ChevronDown size={16} style={{ color: 'var(--ws-ink-mute)', flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: 'var(--ws-ink-mute)', flexShrink: 0 }} />}
        <ShieldAlert size={16} style={{ color: c.icon, flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, color: 'var(--ws-ink)' }}>{advice.title}</span>
        <span style={{ fontSize: 11, color: 'var(--ws-ink-mute)', flexShrink: 0 }}>{advice.source}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px' }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {advice.actions.map((action, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--ws-ink)', lineHeight: 1.55 }}>
                <span style={{ flexShrink: 0, marginTop: 6, height: 6, width: 6, borderRadius: '50%', background: 'currentColor', opacity: 0.4 }} />
                {action}
              </li>
            ))}
          </ul>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--ws-ink-mute)', fontStyle: 'italic' }}>Source: {advice.source}</p>
        </div>
      )}
    </div>
  );
}

function TimelineEvent({ event }: { event: AreaFeedEvent }) {
  const s = SEV[asSev(event.severity)];
  return (
    <div style={{ position: 'relative', display: 'flex', gap: 12, paddingLeft: 24 }}>
      <div style={{
        position: 'absolute', left: 0, top: 6, height: 10, width: 10,
        borderRadius: '50%', background: s.dot,
        boxShadow: '0 0 0 2px var(--ws-surface)',
      }} />
      <div style={{ flex: 1, padding: '4px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: s.fg, flexShrink: 0 }}><SourceIcon source={event.source} size={14} /></span>
          <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ws-ink)' }}>{event.title}</span>
          <span style={{
            flexShrink: 0, padding: '2px 6px', borderRadius: 999,
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            background: s.bg, color: s.fg,
          }}>
            {event.severity}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {event.magnitude != null && <span style={metaText}>M{event.magnitude.toFixed(1)}</span>}
          {event.mmi != null && <span style={metaText}>MMI {event.mmi} ({mmiDescription(event.mmi)})</span>}
          {event.distance_km != null && <span style={metaText}>{event.distance_km < 1 ? '<1' : event.distance_km.toFixed(0)}km</span>}
          <span style={metaText}>{formatDateTime(event.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function WeatherTimelineEvent({ event }: { event: NonNullable<ReportSnapshot['weather_history']>[number] }) {
  const s = SEV[asSev(event.severity)];
  return (
    <div style={{ position: 'relative', display: 'flex', gap: 12, paddingLeft: 24 }}>
      <div style={{
        position: 'absolute', left: 0, top: 6, height: 10, width: 10,
        borderRadius: '50%', background: s.dot,
        boxShadow: '0 0 0 2px var(--ws-surface)',
      }} />
      <div style={{ flex: 1, padding: '4px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CloudLightning size={14} style={{ color: s.fg, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ws-ink)' }}>{event.title}</span>
          <span style={{
            flexShrink: 0, padding: '2px 6px', borderRadius: 999,
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            background: s.bg, color: s.fg,
          }}>
            {event.severity}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {event.precipitation_mm != null && event.precipitation_mm > 0 && <span style={metaText}>{event.precipitation_mm.toFixed(0)}mm rain</span>}
          {event.wind_gust_kmh != null && event.wind_gust_kmh > 0 && <span style={metaText}>{event.wind_gust_kmh.toFixed(0)}km/h gusts</span>}
          {event.distance_km != null && <span style={metaText}>{event.distance_km.toFixed(0)}km</span>}
          <span style={metaText}>{formatDate(event.date)}</span>
        </div>
      </div>
    </div>
  );
}

type TimelineItem =
  | { kind: 'feed'; event: AreaFeedEvent; date: Date }
  | { kind: 'weather'; event: NonNullable<ReportSnapshot['weather_history']>[number]; date: Date };

function ExpandableTimeline({ timeline }: { timeline: TimelineItem[] }) {
  const [sectionOpen, setSectionOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const important = timeline.filter(item => {
    if (item.kind === 'feed') return item.event.severity === 'critical' || item.event.severity === 'warning';
    return item.event.severity === 'critical' || item.event.severity === 'warning' || item.event.severity === 'extreme';
  });
  const rest = timeline.filter(item => !important.includes(item));
  const shown = important.length > 0 ? important : timeline.slice(0, 3);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <button
        type="button"
        onClick={() => setSectionOpen(!sectionOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', textAlign: 'left',
          background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
        }}
      >
        {sectionOpen ? <ChevronDown size={14} style={{ color: 'var(--ws-ink-mute)' }} /> : <ChevronRight size={14} style={{ color: 'var(--ws-ink-mute)' }} />}
        <p style={{ margin: 0, ...sectionLabel }}>
          Event Timeline <span style={{ fontWeight: 400 }}>({timeline.length} total)</span>
        </p>
      </button>

      {sectionOpen && (
        <>
          <div style={{ position: 'relative', display: 'grid', gap: 4, marginLeft: 6 }}>
            <div style={{ position: 'absolute', left: 4, top: 8, bottom: 8, width: 1, background: 'var(--ws-rule)' }} />
            {shown.map((item, i) =>
              item.kind === 'feed'
                ? <TimelineEvent key={`f-${i}`} event={item.event} />
                : <WeatherTimelineEvent key={`w-${i}`} event={item.event} />,
            )}
          </div>

          {rest.length > 0 && (
            <>
              {expanded && (
                <div style={{ position: 'relative', display: 'grid', gap: 4, marginLeft: 6 }}>
                  <div style={{ position: 'absolute', left: 4, top: 8, bottom: 8, width: 1, background: 'var(--ws-rule)' }} />
                  {rest.map((item, i) =>
                    item.kind === 'feed'
                      ? <TimelineEvent key={`fr-${i}`} event={item.event} />
                      : <WeatherTimelineEvent key={`wr-${i}`} event={item.event} />,
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 500, color: 'var(--ws-piq-dark)',
                  background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
                  marginLeft: 6,
                }}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {expanded ? 'Show less' : `Show all ${timeline.length} events`}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function HostedAreaFeedNew({ feed, snapshot }: Props) {
  const watchItems = deriveWatchItems(snapshot);
  const feedEvents = feed?.events ?? [];
  const weatherHistory = snapshot.weather_history ?? [];
  const hazardAdvice = snapshot.hazard_advice ?? [];
  const topEvents = pickTopEvents(feedEvents, snapshot.weather_history);

  const timeline: TimelineItem[] = [
    ...feedEvents.map(e => ({ kind: 'feed' as const, event: e, date: new Date(e.timestamp) })),
    ...weatherHistory.map(e => ({ kind: 'weather' as const, event: e, date: new Date(e.date) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const hasContent = watchItems.length > 0 || topEvents.length > 0 || hazardAdvice.length > 0 || timeline.length > 0;

  if (!hasContent) {
    return (
      <Card>
        <CardHead title="Hazard Intelligence" meta={<ShieldAlert size={16} style={{ color: 'var(--ws-success)' }} />} />
        <div className="ws-card-body">
          <div style={{
            borderRadius: 'var(--ws-radius-sm)',
            border: '1px solid rgba(35,134,54,.30)',
            background: 'rgba(35,134,54,.06)',
            padding: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Info size={20} style={{ color: 'var(--ws-success)', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ws-ink)' }}>
              No significant hazard zones, seismic events, or severe weather detected for this property in the past year.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHead title="Hazard Intelligence" meta={<ShieldAlert size={16} style={{ color: 'var(--ws-r-high)' }} />} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 20 }}>
        {watchItems.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={sectionLabel}>Active Watches</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {watchItems.map((item, i) => <WatchCard key={i} item={item} />)}
            </div>
          </div>
        )}

        {topEvents.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={sectionLabel}>Top Events</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {topEvents.map((evt, i) => <TopEventCard key={i} event={evt} />)}
            </div>
          </div>
        )}

        {hazardAdvice.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={sectionLabel}>Preparedness Advice</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {hazardAdvice.map((advice, i) => <AdviceSection key={i} advice={advice} />)}
            </div>
          </div>
        )}

        {timeline.length > 0 && <ExpandableTimeline timeline={timeline} />}

        <p style={{ margin: 0, fontSize: 11, color: 'var(--ws-ink-mute)', paddingTop: 8, borderTop: '1px solid var(--ws-rule)' }}>
          Sources: GeoNet (earthquakes & volcanic alerts), MetService (severe weather), NEMA (emergency alerts), council hazard maps.
          Events shown are within approximately 100km of this property.
        </p>
      </div>
    </Card>
  );
}

const sectionLabel: React.CSSProperties = {
  margin: 0, fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ws-ink-mute)',
};
const metaText: React.CSSProperties = { fontSize: 11, color: 'var(--ws-ink-mute)' };
