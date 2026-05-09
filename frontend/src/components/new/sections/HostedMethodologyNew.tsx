'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardHead } from '@/components/new/ui/primitives';

const SCORE_BINS = [
  { label: 'Very Low',  range: '0-20',   color: '#22C55E' },
  { label: 'Low',       range: '21-40',  color: '#84CC16' },
  { label: 'Moderate',  range: '41-60',  color: '#EAB308' },
  { label: 'High',      range: '61-80',  color: '#F97316' },
  { label: 'Very High', range: '81-100', color: '#EF4444' },
];

const CATEGORIES = [
  { name: 'Hazards',     weight: 25, color: 'var(--ws-r-vhigh)' },
  { name: 'Liveability', weight: 20, color: 'var(--ws-warm)' },
  { name: 'Transport',   weight: 15, color: 'var(--ws-r-low)' },
  { name: 'Market',      weight: 15, color: 'var(--ws-piq)' },
  { name: 'Planning',    weight: 15, color: 'oklch(0.45 0.16 290)' },
  { name: 'Environment', weight: 10, color: 'var(--ws-success)' },
];

function SubSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ borderTop: '1px solid var(--ws-rule)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0', fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)',
          background: 'transparent', border: 0, cursor: 'pointer', minHeight: 44,
        }}
      >
        {title}
        <ChevronDown size={16} style={{ color: 'var(--ws-ink-mute)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
      </button>
      {open && <div style={{ paddingBottom: 14, fontSize: 12.5, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>{children}</div>}
    </div>
  );
}

export function HostedMethodologyNew() {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ws-ink)' }}>Methodology &amp; sources</h3>
        <ChevronDown size={18} style={{ color: 'var(--ws-ink-mute)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
      </button>
      {open && (
        <div style={{ padding: '0 20px 8px' }}>
          <SubSection title="How scores work">
            <p style={{ margin: '0 0 12px' }}>
              <strong style={{ color: 'var(--ws-ink)' }}>Lower is better.</strong> WhareScore computes a composite risk score (0-100) using a weighted average of six category scores. A score of 0 means minimal risk, while 100 means maximum risk. Each category is derived from normalised sub-indicators — for example, Hazards aggregates flood zone, liquefaction class, seismic activity, wind zone, tsunami zone, wildfire danger days, coastal erosion, EPB proximity, and slope failure.
            </p>
            <div style={{ display: 'flex', borderRadius: 'var(--ws-radius-sm)', overflow: 'hidden', height: 24 }}>
              {SCORE_BINS.map((bin) => (
                <div key={bin.label} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: bin.color, color: '#fff', fontSize: 9, fontWeight: 700,
                }}>
                  {bin.label}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--ws-ink-mute)' }}>
              <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
            </div>
          </SubSection>

          <SubSection title="Category weights">
            <div style={{ display: 'flex', gap: 6 }}>
              {CATEGORIES.map((cat) => (
                <div key={cat.name} style={{
                  flex: cat.weight,
                  background: cat.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '6px 4px', borderRadius: 'var(--ws-radius-sm)',
                  fontSize: 11, fontWeight: 700,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {cat.name} {cat.weight}%
                </div>
              ))}
            </div>
            <p style={{ margin: '10px 0 0' }}>
              Hazards (25%), Liveability (20%), Transport (15%), Market (15%), Planning (15%), Environment (10%).
            </p>
          </SubSection>

          <SubSection title="Data sources">
            <p style={{ margin: 0 }}>
              40+ official government data sources including LINZ property titles &amp; valuations, GWRC hazard maps, MBIE Earthquake-Prone Buildings Register, NZTA road noise, MBIE tenancy bond data, Stats NZ NZDep Index, NZ Police crime victimisations, GTFS public-transport feeds, MoE school directory, LAWA water &amp; air quality, NIWA climate projections, and GWRC contaminated land (SLUR).
            </p>
          </SubSection>
        </div>
      )}
    </Card>
  );
}
