'use client';

import type { PropertyReport } from '@/lib/types';
import { usePersonaStore } from '@/stores/personaStore';
import { getRatingBin } from '@/lib/constants';
import { PersonaToggle } from '@/components/new/ui/primitives';

/**
 * Hero block. Address line, name, subtitle (title/lot/CV), score pill,
 * persona toggle. Reads scores.overall (transformed), coverage (top-level).
 */
export function HeroBlockNew({ report }: { report: PropertyReport }) {
  const persona = usePersonaStore((s) => s.persona);
  const setPersona = usePersonaStore((s) => s.setPersona);

  const score = report.scores?.overall;
  const hasScore = Number.isFinite(score);
  const bin = hasScore ? getRatingBin(score as number) : null;
  const coverage = report.coverage;

  const a = report.address;
  const p = report.property;

  const eyebrowParts: string[] = [];
  if (a.city) eyebrowParts.push(a.city);
  if (a.suburb) eyebrowParts.push(a.suburb);
  if (a.sa2_code) eyebrowParts.push(`SA2 ${a.sa2_code}`);

  const subParts: string[] = [];
  if (p.title_type) subParts.push(p.title_type);
  if (p.title_ref) subParts.push(`#${p.title_ref}`);
  if (p.land_area_sqm) subParts.push(`${p.land_area_sqm} m² lot`);
  if (p.building_area_sqm) subParts.push(`${p.building_area_sqm} m² building`);
  else if (p.floor_area_sqm) subParts.push(`${p.floor_area_sqm} m² floor`);
  if (p.capital_value) subParts.push(`CV ${formatNZD(p.capital_value)}`);

  return (
    <section style={{
      background: 'var(--ws-surface)',
      borderBottom: '1px solid var(--ws-rule)',
      padding: '24px 24px 20px',
    }}>
      {eyebrowParts.length > 0 && (
        <div style={{
          fontSize: 11.5, fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--ws-piq)', marginBottom: 4,
        }}>
          {eyebrowParts.join(' · ')}
        </div>
      )}

      <h1 style={{
        fontSize: 'clamp(22px, 3vw, 26px)', fontWeight: 700,
        letterSpacing: '-0.01em', color: 'var(--ws-ink)', margin: '0 0 4px',
      }}>
        {a.full_address ?? 'Property'}
      </h1>

      {subParts.length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--ws-ink-soft)', margin: '0 0 14px' }}>
          {subParts.join(' · ')}
        </p>
      )}

      {hasScore && bin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 999,
            background: bin.color, color: 'oklch(0.18 0.04 70)',
            fontWeight: 700, fontSize: 14,
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {(score as number).toFixed(1)}
            </span>
            <small style={{ fontSize: 11, opacity: 0.7 }}>/100</small>
          </span>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ws-ink)' }}>{bin.label} Risk</span>
          {coverage && (
            <span style={{ fontSize: 12, color: 'var(--ws-ink-mute)' }}>
              · {coverage.available}/{coverage.total} layers
            </span>
          )}
        </div>
      )}

      <PersonaToggle value={persona} onChange={setPersona} />
    </section>
  );
}

function formatNZD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString('en-NZ')}`;
}
