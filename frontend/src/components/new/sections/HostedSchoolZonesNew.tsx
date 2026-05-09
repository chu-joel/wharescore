'use client';

import { School } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface SchoolZone {
  school_name: string; school_id: number; institution_type: string;
  distance_m?: number | null; eqi?: number | null; roll?: number | null;
}

const CAP_M = 5000;

function typeLabel(t: string): string {
  if (!t) return '';
  const low = t.toLowerCase();
  if (low.includes('contributing')) return 'Primary (Yr 1-6)';
  if (low.includes('full primary')) return 'Full Primary (Yr 1-8)';
  if (low.includes('intermediate')) return 'Intermediate (Yr 7-8)';
  if (low.includes('secondary')) return 'Secondary (Yr 9-13)';
  if (low.includes('composite')) return 'Composite (Yr 1-13)';
  return t;
}

export function HostedSchoolZonesNew({ snapshot }: { snapshot: ReportSnapshot }) {
  const raw = (snapshot.school_zones ?? []) as SchoolZone[];
  const zones = raw.filter((z) => z.distance_m == null || z.distance_m <= CAP_M);
  if (zones.length === 0) return null;

  return (
    <Card>
      <CardHead title={`In school enrolment zone${zones.length !== 1 ? 's' : ''}`} meta={`${zones.length} school${zones.length !== 1 ? 's' : ''}`} />
      <div className="ws-card-body">
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 'var(--ws-radius-sm)',
          background: 'rgba(45,106,79,.08)', color: 'var(--ws-success)',
          fontSize: 12, fontWeight: 600, marginBottom: 10,
        }}>
          <School size={14} />
          You can enrol here
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {zones.map((z) => (
            <li key={z.school_id} style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              gap: 12, alignItems: 'baseline',
              padding: '10px 0',
              borderTop: '1px solid var(--ws-rule)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ws-ink)' }}>{z.school_name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ws-ink-mute)', marginTop: 1 }}>
                  {typeLabel(z.institution_type)}
                  {z.roll != null && ` · Roll ${z.roll.toLocaleString()}`}
                  {z.eqi != null && ` · EQI ${z.eqi}`}
                </div>
              </div>
              {z.distance_m != null && (
                <span style={{ fontSize: 12, color: 'var(--ws-ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
                  {z.distance_m >= 1000 ? `${(z.distance_m / 1000).toFixed(1)} km` : `${z.distance_m} m`}
                </span>
              )}
            </li>
          ))}
        </ul>

        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          Source: Ministry of Education enrolment zone boundaries. Zones may change; verify with the school.
        </p>
      </div>
    </Card>
  );
}
