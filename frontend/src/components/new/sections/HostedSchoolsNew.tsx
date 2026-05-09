'use client';

import { GraduationCap } from 'lucide-react';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface School {
  name: string;
  type: string;
  eqi: number | null;
  decile: number | null;
  distance_m: number;
  in_zone: boolean;
  roll?: number;
}

function eqiColor(eqi: number): string {
  if (eqi <= 440) return 'var(--ws-success)';
  if (eqi <= 480) return 'oklch(0.50 0.13 75)';
  return 'var(--ws-r-vhigh)';
}

export function HostedSchoolsNew({ rawReport }: { rawReport: Record<string, unknown> }) {
  const live = (rawReport.liveability ?? {}) as unknown as Record<string, unknown>;
  const schools = (live.schools_1500m ?? []) as School[];
  const inZone = (live.in_zone_schools ?? []) as School[];
  if (schools.length === 0 && inZone.length === 0) return null;

  const inZoneNames = new Set(inZone.map((s) => s.name));
  const others = schools.filter((s) => !s.in_zone && !inZoneNames.has(s.name)).slice(0, 8);
  if (others.length === 0) return null;

  return (
    <Card>
      <CardHead title="Other nearby schools" meta={`${others.length} within 1.5 km`} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ws-ink-soft)' }}>
          <GraduationCap size={14} style={{ color: 'var(--ws-piq)' }} />
          Schools you&rsquo;re <strong style={{ color: 'var(--ws-ink)' }}>not</strong> in the enrolment zone for. You can still apply out-of-zone if they have spare places.
        </div>

        {/* Desktop table / mobile list */}
        <div className="hidden sm:block">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>School</th>
                <th style={th}>Type</th>
                <th style={{ ...th, textAlign: 'center' }}>EQI</th>
                <th style={{ ...th, textAlign: 'center' }}>Roll</th>
                <th style={{ ...th, textAlign: 'right' }}>Distance</th>
              </tr>
            </thead>
            <tbody>
              {others.map((s) => (
                <tr key={s.name} style={{ borderTop: '1px solid var(--ws-rule)' }}>
                  <td style={tdName}>{s.name}</td>
                  <td style={tdMeta}>{s.type || '–'}</td>
                  <td style={{ ...tdMeta, textAlign: 'center' }}>
                    {s.eqi != null
                      ? <span style={{ color: eqiColor(s.eqi), fontWeight: 600 }}>{s.eqi}</span>
                      : '–'}
                  </td>
                  <td style={{ ...tdMeta, textAlign: 'center' }}>{s.roll?.toLocaleString() ?? '–'}</td>
                  <td style={{ ...tdMeta, textAlign: 'right' }}>{Math.round(s.distance_m)} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden" style={{ display: 'grid', gap: 6 }}>
          {others.map((s) => (
            <div key={s.name} style={{
              border: '1px solid var(--ws-rule)',
              borderRadius: 'var(--ws-radius-sm)',
              background: 'var(--ws-bg-2)',
              padding: '8px 10px',
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
              fontSize: 12.5,
            }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, color: 'var(--ws-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--ws-ink-mute)' }}>{s.type || 'School'}</p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--ws-ink-soft)' }}>{Math.round(s.distance_m)} m</span>
            </div>
          ))}
        </div>

        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          Source: Ministry of Education. EQI = Education Quality Indicator (lower is better). Deciles were retired in 2023.
        </p>
      </div>
    </Card>
  );
}

const th: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'left',
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--ws-piq-dark)',
};
const tdName: React.CSSProperties = { padding: '8px', fontSize: 12.5, fontWeight: 500, color: 'var(--ws-ink)' };
const tdMeta: React.CSSProperties = { padding: '8px', fontSize: 12, color: 'var(--ws-ink-soft)' };
