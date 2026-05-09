'use client';

import { Waves, TrendingDown } from 'lucide-react';
import { Card, CardHead, SeverityTag } from '@/components/new/ui/primitives';
import type { Severity } from '@/components/new/ui/primitives';

export type CoastalTier = 'happens_now' | 'within_30_years' | 'longer_term' | 'not_applicable';

export interface CoastalScenarioPoint {
  year: number;
  slr_cm: number;
}

export interface CoastalScenario {
  label: string;
  description: string;
  points: CoastalScenarioPoint[];
}

export interface CoastalExposure {
  tier: CoastalTier;
  ground_elevation_m: number;
  coast_distance_m: number | null;
  storm_tide_100yr_distance_m: number | null;
  vlm_mm_yr: number | null;
  scenarios: CoastalScenario[];
  headline: string;
  narrative: string;
  narrative_renter?: string;
  score_impact: {
    delta: number;
    max_possible: number;
    suppressed_by_council_layer: boolean;
  };
}

interface Props {
  coastal: CoastalExposure | null;
  persona?: 'renter' | 'buyer';
}

const TIER_LABELS: Record<CoastalTier, string> = {
  happens_now: 'Happens now',
  within_30_years: 'Within 30 years',
  longer_term: 'Longer-term',
  not_applicable: 'Not applicable',
};

const TIER_STYLE: Record<CoastalTier, { sev: Severity; iconColor: string; borderColor: string }> = {
  happens_now: { sev: 'crit', iconColor: 'var(--ws-r-vhigh)', borderColor: 'var(--ws-r-vhigh)' },
  within_30_years: { sev: 'warn', iconColor: 'var(--ws-r-high)', borderColor: 'var(--ws-r-high)' },
  longer_term: { sev: 'info', iconColor: 'var(--ws-piq)', borderColor: 'var(--ws-piq)' },
  not_applicable: { sev: 'info', iconColor: 'var(--ws-ink-mute)', borderColor: 'var(--ws-rule)' },
};

export function HostedCoastalTimelineNew({ coastal, persona }: Props) {
  if (!coastal || coastal.tier === 'not_applicable') return null;
  if (persona === 'renter' && coastal.tier !== 'happens_now') return null;

  const style = TIER_STYLE[coastal.tier];

  return (
    <Card className="" >
      <div style={{ borderLeft: `4px solid ${style.borderColor}`, borderTopLeftRadius: 'var(--ws-radius)', borderBottomLeftRadius: 'var(--ws-radius)' }}>
        <CardHead
          title="Coastal exposure"
          meta={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <SeverityTag severity={style.sev} label={TIER_LABELS[coastal.tier]} />
              {coastal.score_impact.delta > 0 && (
                <span style={{ fontSize: 11, color: 'var(--ws-ink-soft)' }}>+{coastal.score_impact.delta} Hazards</span>
              )}
            </span>
          }
        />
        <div className="ws-card-body" style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Waves size={22} style={{ color: style.iconColor, flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ws-ink)' }}>{coastal.headline}</p>
          </div>

          <div style={{ fontSize: 13.5, color: 'var(--ws-ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {persona === 'renter' && coastal.narrative_renter ? coastal.narrative_renter : coastal.narrative}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <Stat label="Height above high tide" value={`${coastal.ground_elevation_m.toFixed(1)}m`} />
            {coastal.coast_distance_m != null && (
              <Stat label="Distance to the coast" value={formatCoastDistance(coastal.coast_distance_m)} />
            )}
            {coastal.storm_tide_100yr_distance_m != null && (
              <Stat label="A big storm reaches within" value={`${coastal.storm_tide_100yr_distance_m}m`} />
            )}
            {coastal.vlm_mm_yr != null && Math.abs(coastal.vlm_mm_yr) >= 0.5 && (
              <Stat
                label="The ground here is"
                value={coastal.vlm_mm_yr < 0 ? 'sinking slowly' : 'rising slowly'}
                icon={coastal.vlm_mm_yr < -0.5 ? <TrendingDown size={13} /> : undefined}
              />
            )}
          </div>

          <details style={{ borderTop: '1px solid var(--ws-rule)', paddingTop: 14 }}>
            <summary style={summaryStyle}>
              <span>How much higher will the sea be here?</span>
              <span style={chevronStyle}>›</span>
            </summary>
            <div style={{ marginTop: 12 }}>
              <ScenarioTable scenarios={coastal.scenarios} />
            </div>
          </details>

          <details style={{ borderTop: '1px solid var(--ws-rule)', paddingTop: 14 }}>
            <summary style={summaryStyle}>
              <span>How this affected the score</span>
              <span style={chevronStyle}>›</span>
            </summary>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--ws-ink-soft)', lineHeight: 1.6 }}>
              Coastal risk can move the Hazards score by up to {coastal.score_impact.max_possible} points.
              This property moved {coastal.score_impact.delta}
              {coastal.score_impact.suppressed_by_council_layer
                ? '. Softened because a council map already flags this property for coastal hazard.'
                : '.'}
            </p>
          </details>

          <p style={{ margin: 0, fontSize: 11, color: 'var(--ws-ink-mute)' }}>
            Source:{' '}
            <a href="https://searise.nz/" target="_blank" rel="noopener noreferrer" style={linkStyle}>
              NZ SeaRise
            </a>{' '}
            (sea level projections) ·{' '}
            <a
              href="https://niwa.co.nz/hazards/coastal-hazards/extreme-coastal-flood-maps-aotearoa-new-zealand"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              NIWA
            </a>{' '}
            (storm tide modelling)
          </p>
        </div>
      </div>
    </Card>
  );
}

function formatCoastDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--ws-bg-2)', borderRadius: 'var(--ws-radius-sm)', padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--ws-ink-mute)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}
        {value}
      </div>
    </div>
  );
}

function ScenarioTable({ scenarios }: { scenarios: CoastalScenario[] }) {
  const years = Array.from(new Set(scenarios.flatMap((s) => s.points.map((p) => p.year)))).sort();
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Scenario</th>
            {years.map((y) => (
              <th key={y} style={{ ...th, textAlign: 'right' }}>By {y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => (
            <tr key={s.label} style={{ borderTop: '1px solid var(--ws-rule)' }}>
              <td style={td}>
                <div style={{ fontWeight: 500, color: 'var(--ws-ink)' }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ws-ink-mute)' }}>{s.description}</div>
              </td>
              {years.map((y) => {
                const point = s.points.find((p) => p.year === y);
                return (
                  <td key={y} style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {point ? `+${point.slr_cm}cm` : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const summaryStyle: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', listStyle: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  color: 'var(--ws-ink)',
};
const chevronStyle: React.CSSProperties = { color: 'var(--ws-ink-mute)', fontSize: 18 };
const th: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'left',
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--ws-piq-dark)',
};
const td: React.CSSProperties = { padding: '8px 8px', fontSize: 12.5, color: 'var(--ws-ink-soft)' };
const linkStyle: React.CSSProperties = { color: 'var(--ws-piq-dark)', textDecoration: 'underline' };
