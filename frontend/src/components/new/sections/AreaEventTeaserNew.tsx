'use client';

import { ShieldAlert, ShieldCheck, Activity, CloudLightning, Radio } from 'lucide-react';
import type { AreaFeedResponse } from '@/hooks/useAreaFeed';

interface Props {
  feed: AreaFeedResponse;
  addressId: number;
}

function sourceLabel(s: string): string {
  switch (s) {
    case 'geonet': return 'seismic event';
    case 'metservice': return 'weather warning';
    case 'nema': return 'emergency alert';
    case 'volcano': return 'volcanic alert';
    case 'council': return 'council hazard record';
    case 'gns': return 'GNS hazard record';
    case 'open_meteo': return 'extreme weather event';
    default: return 'other alert';
  }
}

function pluralise(n: number, s: string) { return n === 1 ? `${n} ${s}` : `${n} ${s}s`; }

function SourceIcon({ source }: { source: string }) {
  if (source === 'geonet' || source === 'volcano') return <Activity size={13} />;
  if (source === 'metservice') return <CloudLightning size={13} />;
  if (source === 'nema') return <Radio size={13} />;
  return null;
}

/**
 * Event-feed teaser. Green "all clear" when zero events; amber summary
 * grouping by source when events exist. Drives intent toward the full
 * report's event timeline.
 */
export function AreaEventTeaserNew({ feed }: Props) {
  const { summary, events } = feed;

  if (summary.total_events === 0) {
    return (
      <div style={{
        borderRadius: 'var(--ws-radius)',
        border: '1px solid rgba(45,106,79,.30)',
        background: 'rgba(45,106,79,.04)',
        padding: 14,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <ShieldCheck size={18} style={{ color: 'var(--ws-success)', marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ws-success)' }}>
            No recent alerts
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.5 }}>
            No significant seismic, weather, or emergency events detected near this property recently.
          </p>
        </div>
      </div>
    );
  }

  const counts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.source] = (acc[e.source] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{
      borderRadius: 'var(--ws-radius)',
      border: '1px solid rgba(213,94,0,.30)',
      background: 'rgba(213,94,0,.04)',
      padding: 14,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <ShieldAlert size={18} style={{ color: 'var(--ws-r-high)', marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'grid', gap: 6 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ws-r-high)' }}>
          {pluralise(summary.total_events, 'recent event')} tracked near this property
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(counts).map(([source, count]) => (
            <span key={source} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 999,
              background: 'rgba(213,94,0,.10)',
              fontSize: 11.5, fontWeight: 500, color: 'var(--ws-r-high)',
            }}>
              <SourceIcon source={source} />
              {pluralise(count, sourceLabel(source))}
            </span>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)' }}>
          Get the full report to see event details, distances, and severity levels.
        </p>
      </div>
    </div>
  );
}
