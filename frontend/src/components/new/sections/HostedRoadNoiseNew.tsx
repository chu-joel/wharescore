'use client';

import { Volume2 } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

export function HostedRoadNoiseNew({ snapshot }: { snapshot: ReportSnapshot }) {
  const db = snapshot.road_noise?.laeq24h;
  if (!db) return null;

  let level = 'Low'; let color = 'var(--ws-success)';
  let description = 'Minimal road noise impact at this location.';
  if (db >= 70)      { level = 'Very High'; color = 'var(--ws-r-vhigh)'; description = 'Significant road noise. May affect sleep and outdoor enjoyment. Consider double glazing.'; }
  else if (db >= 65) { level = 'High';      color = 'var(--ws-r-high)';  description = 'Noticeable road noise. Conversation outdoors may be difficult at peak times.'; }
  else if (db >= 60) { level = 'Moderate';  color = 'oklch(0.50 0.13 75)'; description = 'Moderate traffic noise. Generally manageable but noticeable with windows open.'; }
  else if (db >= 55) { level = 'Low-Moderate'; description = 'Some background traffic noise. Typical for suburban streets near main roads.'; }

  return (
    <Card>
      <CardHead title="Road traffic noise" meta={`${db} dB LAeq(24h)`} />
      <div className="ws-card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 'var(--ws-radius-sm)',
          background: db >= 65 ? 'rgba(213,94,0,.10)' : 'var(--ws-bg-2)',
          color, display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <Volume2 size={18} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 32, fontWeight: 800, color: 'var(--ws-ink)',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1,
            }}>
              {db}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ws-ink-mute)' }}>dB</span>
            <span style={{
              padding: '2px 8px', borderRadius: 4,
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              color, background: 'var(--ws-bg-2)',
              marginLeft: 4,
            }}>
              {level}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>
            {description}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
            Source: Waka Kotahi / NZTA national road noise contours (state highways &amp; arterials).
          </p>
        </div>
      </div>
    </Card>
  );
}
