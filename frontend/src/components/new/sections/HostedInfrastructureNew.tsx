'use client';

import { Construction } from 'lucide-react';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface Project { name: string; sector: string; status: string; distance_km: number; cost_estimate?: string }

const SECTOR_COLOUR: Record<string, { bg: string; fg: string }> = {
  Transport: { bg: 'rgba(86,180,233,.12)', fg: 'oklch(0.42 0.10 230)' },
  Water:     { bg: 'rgba(13,115,119,.12)', fg: 'var(--ws-piq-dark)' },
  Healthcare:{ bg: 'rgba(196,45,45,.10)',  fg: 'var(--ws-r-vhigh)' },
  Education: { bg: 'rgba(230,159,0,.16)',  fg: 'oklch(0.42 0.13 75)' },
  Housing:   { bg: 'rgba(45,106,79,.12)',  fg: 'var(--ws-success)' },
};

export function HostedInfrastructureNew({ rawReport }: { rawReport: Record<string, unknown> }) {
  const planning = (rawReport.planning ?? {}) as unknown as Record<string, unknown>;
  const projects = (planning.infrastructure_5km ?? planning.infrastructure_projects ?? []) as Project[];
  if (!Array.isArray(projects) || projects.length === 0) return null;

  const sorted = [...projects].sort((a, b) => (a.distance_km ?? 99) - (b.distance_km ?? 99)).slice(0, 8);
  const showing = sorted.length;
  const total = projects.length;

  return (
    <Card>
      <CardHead title="Infrastructure projects" meta={showing < total ? `${showing} of ${total} within 5 km` : `${total} within 5 km`} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 8 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11.5, color: 'var(--ws-ink-soft)',
        }}>
          <Construction size={13} style={{ color: 'var(--ws-piq)' }} />
          Closest projects shown first.
        </div>
        {sorted.map((p, i) => {
          const c = SECTOR_COLOUR[p.sector] ?? { bg: 'var(--ws-bg-2)', fg: 'var(--ws-ink-soft)' };
          return (
            <div key={`${p.name}-${i}`} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px',
              border: '1px solid var(--ws-rule)',
              borderRadius: 'var(--ws-radius-sm)',
            }}>
              <span style={{
                flexShrink: 0,
                padding: '2px 8px', borderRadius: 4,
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                background: c.bg, color: c.fg,
              }}>
                {p.sector}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 12.5, fontWeight: 500, color: 'var(--ws-ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.name}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
                  {p.distance_km != null && `${p.distance_km.toFixed(1)} km away`}
                  {p.status && ` · ${p.status}`}
                </p>
              </div>
            </div>
          );
        })}
        <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          Source: NZ Infrastructure Commission, council long-term plans.
        </p>
      </div>
    </Card>
  );
}
