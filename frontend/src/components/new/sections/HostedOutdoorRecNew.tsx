'use client';

import { Mountain, TreePine, Tent } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface DocItem { name: string; status: string; category: string; distance_m: number }

const fmt = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

export function HostedOutdoorRecNew({ snapshot }: { snapshot: ReportSnapshot }) {
  const doc = snapshot.nearby_doc as { huts: DocItem[]; tracks: DocItem[]; campsites: DocItem[] } | undefined;
  if (!doc) return null;
  const huts = doc.huts ?? [];
  const tracks = doc.tracks ?? [];
  const camps = doc.campsites ?? [];
  const total = huts.length + tracks.length + camps.length;
  if (total === 0) return null;

  return (
    <Card>
      <CardHead title="Outdoor &amp; recreation" meta={`${total} within 5 km`} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 14 }}>
        <Group items={tracks.slice(0, 5)} Icon={TreePine} color="var(--ws-success)" label="Walking & tramping tracks" total={tracks.length} />
        <Group items={huts.slice(0, 5)}   Icon={Mountain} color="var(--ws-warm)"     label="DOC huts"               total={huts.length} />
        <Group items={camps.slice(0, 5)}  Icon={Tent}     color="var(--ws-r-low)"    label="DOC campsites"           total={camps.length} />
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          Source: Department of Conservation. Distances are straight-line.
        </p>
      </div>
    </Card>
  );
}

function Group({ items, Icon, color, label, total }: {
  items: DocItem[]; Icon: typeof Mountain; color: string; label: string; total: number;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color, marginBottom: 6,
      }}>
        <Icon size={13} />
        {label} <span style={{ opacity: 0.7 }}>({total})</span>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr auto',
            gap: 12, padding: '8px 0',
            borderTop: i === 0 ? 'none' : '1px solid var(--ws-rule)',
          }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ws-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name || 'DOC site'}
              </p>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
                {item.category || item.status}
              </p>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--ws-ink-soft)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {fmt(item.distance_m)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
