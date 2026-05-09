'use client';

import { AlertTriangle } from 'lucide-react';
import { RentBandGauge } from '@/components/property/RentBandGauge';
import type { ReportSnapshot, RentAdjustment, RentAreaContext } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface Props {
  snapshot: ReportSnapshot;
  rentBand: ReturnType<typeof import('@/stores/hostedReportStore').computeRentBand>;
  persona: string;
  userRent?: number | null;
}

const VERDICT: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'below-market':  { label: "You're getting good value",   color: 'var(--ws-success)',  bg: 'rgba(45,106,79,.05)', border: 'rgba(45,106,79,.30)' },
  'fair':          { label: 'Your rent looks fair',        color: 'var(--ws-success)',  bg: 'rgba(45,106,79,.05)', border: 'rgba(45,106,79,.30)' },
  'slightly-high': { label: 'Your rent is a bit high',     color: 'oklch(0.50 0.13 75)', bg: 'rgba(230,159,0,.05)', border: 'rgba(230,159,0,.30)' },
  'high':          { label: 'Your rent is high for this area',     color: 'var(--ws-r-vhigh)', bg: 'rgba(196,45,45,.04)', border: 'rgba(196,45,45,.30)' },
  'very-high':     { label: 'Your rent is well above market',      color: 'var(--ws-r-vhigh)', bg: 'rgba(196,45,45,.04)', border: 'rgba(196,45,45,.30)' },
};

const BEDS_ORDER: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, '5+': 5 };
const TYPE_ORDER: Record<string, number> = { House: 1, Townhouse: 2, Flat: 3, Apartment: 4, Unit: 5, Room: 6 };

export function HostedRentAdvisorNew({ snapshot, rentBand, persona, userRent }: Props) {
  if (!rentBand.baseline) return null;
  if (persona !== 'renter') return null;

  const vc = rentBand.verdict ? VERDICT[rentBand.verdict] : null;
  const hazardAdjs = rentBand.baseline.adjustments.filter((a: RentAdjustment) => a.category === 'hazard');

  const rawMarket = (snapshot.report.market ?? {}) as Record<string, unknown>;
  const overviewRaw = (rawMarket.rental_overview ?? []) as { dwelling_type: string; beds: string | null; median: number; bond_count: number }[];
  const overview = [...overviewRaw].sort((a, b) => {
    const ta = TYPE_ORDER[a.dwelling_type] ?? 99;
    const tb = TYPE_ORDER[b.dwelling_type] ?? 99;
    if (ta !== tb) return ta - tb;
    const ba = a.beds == null || a.beds === 'All' ? 98 : (BEDS_ORDER[a.beds] ?? 97);
    const bb = b.beds == null || b.beds === 'All' ? 98 : (BEDS_ORDER[b.beds] ?? 97);
    return ba - bb;
  });

  return (
    <Card>
      <CardHead title="Is your rent fair?" meta="Based on MBIE bond data" />
      <div className="ws-card-body" style={{ display: 'grid', gap: 14 }}>
        {/* Verdict */}
        {vc && rentBand.verdict ? (
          <div style={{
            border: `1px solid ${vc.border}`, background: vc.bg,
            borderRadius: 'var(--ws-radius)', padding: 14,
          }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: vc.color }}>{vc.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ws-ink-soft)' }}>
              We estimate fair rent at <strong style={{ color: 'var(--ws-ink)' }}>${rentBand.bandLow}-${rentBand.bandHigh}/wk</strong>.
              {rentBand.baseline.raw_median != null && <> Area median: ${rentBand.baseline.raw_median}/wk.</>}
            </p>
          </div>
        ) : (
          <div style={{
            border: '1px solid rgba(13,115,119,.30)', background: 'rgba(13,115,119,.05)',
            borderRadius: 'var(--ws-radius)', padding: 14,
          }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ws-piq-dark)' }}>Fair rent estimate</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ws-ink-soft)' }}>
              We estimate fair rent at <strong style={{ color: 'var(--ws-ink)' }}>${rentBand.bandLow}-${rentBand.bandHigh}/wk</strong>, with a possible range of ${rentBand.bandLowOuter}-${rentBand.bandHighOuter}/wk.
            </p>
          </div>
        )}

        <RentBandGauge
          bandLow={rentBand.bandLow}
          bandHigh={rentBand.bandHigh}
          bandLowOuter={rentBand.bandLowOuter}
          bandHighOuter={rentBand.bandHighOuter}
          userRent={userRent ?? rentBand.baseline.raw_median}
          rawMedian={rentBand.baseline.raw_median}
        />

        {/* Influences */}
        {(rentBand.baseline.adjustments.length > 0 || rentBand.appliedDeltas.length > 0) && (
          <div>
            <h4 style={subHeading}>What&rsquo;s influencing your rent</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
              {rentBand.baseline.adjustments.map((adj: RentAdjustment) => (
                <li key={adj.factor} style={listLine}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 50,
                    flexShrink: 0, marginTop: 7,
                    background:
                      adj.category === 'hazard'   ? 'var(--ws-r-vhigh)'
                    : adj.category === 'location' ? 'var(--ws-r-low)'
                                                  : 'var(--ws-success)',
                  }} />
                  <span>{adj.label}{adj.reason && adj.reason.toLowerCase() !== adj.label.toLowerCase() && <span style={{ opacity: 0.6 }}> ({adj.reason})</span>}</span>
                </li>
              ))}
              {rentBand.appliedDeltas.map((d) => (
                <li key={d.label} style={listLine}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 50,
                    flexShrink: 0, marginTop: 7,
                    background: d.pctHigh >= 0 ? 'var(--ws-success)' : 'var(--ws-warm)',
                  }} />
                  <span>{d.label} <span style={{ opacity: 0.6 }}>({d.pctLow > 0 ? '+' : ''}{d.pctLow}% to {d.pctHigh > 0 ? '+' : ''}{d.pctHigh}%)</span></span>
                </li>
              ))}
            </ul>
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
              Area median is ${rentBand.baseline.raw_median}/wk based on {rentBand.baseline.bond_count} recent bonds in {snapshot.meta.sa2_name}.
            </p>
          </div>
        )}

        {/* Hazard chips */}
        {hazardAdjs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {hazardAdjs.map((h: RentAdjustment) => (
              <span key={h.factor} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 999,
                background: 'rgba(196,45,45,.08)', border: '1px solid rgba(196,45,45,.20)',
                color: 'var(--ws-r-vhigh)', fontSize: 11.5, fontWeight: 500,
              }}>
                <AlertTriangle size={11} />
                {h.label}
              </span>
            ))}
          </div>
        )}

        {/* Area context */}
        {rentBand.baseline.area_context.length > 0 && (
          <div>
            <h4 style={subHeading}>About {snapshot.meta.sa2_name} (suburb average)</h4>
            <p style={{ margin: '0 0 6px', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
              Area-level numbers for context; your property&rsquo;s specific stats are above.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 4 }}>
              {rentBand.baseline.area_context.map((ctx: RentAreaContext) => (
                <div key={ctx.factor} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>
                  <span style={{
                    color:
                      ctx.is_area_wide_hazard ? 'var(--ws-r-vhigh)'
                    : ctx.direction === 'up' ? 'var(--ws-success)'
                    : ctx.direction === 'down' ? 'var(--ws-warm)'
                    : 'var(--ws-ink-mute)',
                  }}>
                    {ctx.is_area_wide_hazard ? '!' : ctx.direction === 'up' ? '↑' : ctx.direction === 'down' ? '↓' : '–'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctx.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overview table */}
        {overview.length > 1 && (
          <div>
            <h4 style={subHeading}>Area rents by type</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Type</th>
                    <th style={th}>Beds</th>
                    <th style={{ ...th, textAlign: 'right' }}>Median</th>
                    <th style={{ ...th, textAlign: 'right' }}>Bonds</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.slice(0, 10).map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--ws-rule)' }}>
                      <td style={td}>{r.dwelling_type}</td>
                      <td style={td}>{r.beds ?? 'All'}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 500, color: 'var(--ws-ink)' }}>${r.median}/wk</td>
                      <td style={{ ...td, textAlign: 'right' }}>{r.bond_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          Based on MBIE bond records, council valuations, and hazard data. Not a registered valuation.
        </p>
      </div>
    </Card>
  );
}

const subHeading: React.CSSProperties = {
  margin: '0 0 8px', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ws-ink-mute)',
};
const listLine: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  fontSize: 13, color: 'var(--ws-ink-soft)', lineHeight: 1.55,
};
const th: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'left',
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--ws-piq-dark)',
};
const td: React.CSSProperties = { padding: '6px 8px', fontSize: 12, color: 'var(--ws-ink-soft)' };
