'use client';

import { ThumbsUp, AlertTriangle, Info } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface AmenityItem { name: string; label: string; distance_m: number }

function fmt(m: number) { return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`; }

const GROUPS: Array<{
  key: 'good' | 'caution' | 'info';
  Icon: typeof ThumbsUp; label: string; color: string;
}> = [
  { key: 'good',    Icon: ThumbsUp,      label: 'Good to have nearby', color: 'var(--ws-success)' },
  { key: 'caution', Icon: AlertTriangle, label: 'Be aware of',         color: 'var(--ws-warm)' },
  { key: 'info',    Icon: Info,          label: 'Also nearby',         color: 'var(--ws-r-low)' },
];

export function HostedNearbyHighlightsNew({ snapshot }: { snapshot: ReportSnapshot }) {
  const h = snapshot.nearby_highlights;
  if (!h) return null;
  const lists = {
    good:    ((h.good ?? []) as unknown as AmenityItem[]).slice(0, 10),
    caution: ((h.caution ?? []) as unknown as AmenityItem[]).slice(0, 8),
    info:    ((h.info ?? []) as unknown as AmenityItem[]).slice(0, 6),
  };
  const total = lists.good.length + lists.caution.length + lists.info.length;
  if (total === 0) return null;

  return (
    <Card>
      <CardHead title="What's nearby" meta="Within 1.5 km" />
      <div className="ws-card-body" style={{ display: 'grid', gap: 14 }}>
        {GROUPS.map(({ key, Icon, label, color }) => {
          const items = lists[key];
          if (items.length === 0) return null;
          return (
            <div key={key}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color, marginBottom: 6,
              }}>
                <Icon size={13} />
                {label}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {items.map((item, i) => (
                  <li key={`${key}-${i}`} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    gap: 12, padding: '6px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--ws-rule)',
                    fontSize: 13, color: 'var(--ws-ink)',
                  }}>
                    <span>{item.name || item.label}</span>
                    <span style={{ color: 'var(--ws-ink-soft)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(item.distance_m)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
