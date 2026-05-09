'use client';

import { AlertTriangle, HelpCircle } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { getFloodTier, type FloodTier } from '@/lib/hazards';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface HHRow { area: string; status: 'flagged' | 'unverified'; label: string; whatToCheck: string }

const UNVERIFIED = 'Not verified. Ask at viewing.';

export function HostedHealthyHomesNew({ report }: { report: PropertyReport }) {
  const hazards = (report as unknown as Record<string, unknown>).hazards as Record<string, unknown> | undefined;
  if (!hazards) return null;

  const windZone = String(hazards.wind_zone || '').toUpperCase();
  const floodTier = getFloodTier(hazards as Parameters<typeof getFloodTier>[0]);
  const floodFlagged = floodTier === 'severe' || floodTier === 'moderate';
  const highLiq = /high/i.test(String(hazards.liquefaction_zone || hazards.liquefaction || ''));
  const coastalEr = !!(hazards.coastal_erosion || hazards.coastal_erosion_exposure || hazards.coastal_exposure);
  const moistureFlagged = floodFlagged || highLiq || coastalEr;
  const windFlagged = ['H', 'VH', 'HIGH', 'VERY HIGH'].includes(windZone);
  const floodText = ((): string | null => {
    switch (floodTier as FloodTier) {
      case 'severe': return 'high-risk flood zone';
      case 'moderate': return 'moderate flood zone';
      default: return null;
    }
  })();

  const rows: HHRow[] = [
    { area: 'Heating', status: 'unverified', label: UNVERIFIED, whatToCheck: 'Fixed heater capable of ≥ 1.5 kW in the main living area' },
    { area: 'Insulation', status: 'unverified', label: UNVERIFIED, whatToCheck: 'Ceiling ≥ R2.9, underfloor ≥ R1.3' },
    { area: 'Ventilation', status: 'unverified', label: UNVERIFIED, whatToCheck: 'Extractor fans in kitchen & bathroom vent to outside' },
    {
      area: 'Moisture',
      status: moistureFlagged ? 'flagged' : 'unverified',
      label: moistureFlagged
        ? `Area hazard: ${[floodText, highLiq && 'high liquefaction', coastalEr && 'coastal erosion'].filter(Boolean).join(', ')}`
        : UNVERIFIED,
      whatToCheck: 'No visible mould, condensation, or rising damp',
    },
    {
      area: 'Draught',
      status: windFlagged ? 'flagged' : 'unverified',
      label: windFlagged ? `Wind zone ${windZone}, higher draught risk` : UNVERIFIED,
      whatToCheck: 'Window and door seals intact, no draughts',
    },
  ];
  const flaggedCount = rows.filter((r) => r.status === 'flagged').length;

  return (
    <Card>
      <CardHead title="Healthy Homes assessment" meta={flaggedCount > 0 ? `${flaggedCount} area flagged` : '5 areas to verify'} />
      <div className="ws-card-body">
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>
          The Healthy Homes Standards can only be verified in person. Use this as a checklist at the viewing and ask your landlord for the signed compliance statement (legally required since July 2025).
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Area</th>
                <th style={th}>Status</th>
                <th style={th}>What to check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.area} style={{ borderTop: '1px solid var(--ws-rule)' }}>
                  <td style={tdName}>{r.area}</td>
                  <td style={td}>
                    {r.status === 'flagged' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ws-r-high)', fontSize: 12 }}>
                        <AlertTriangle size={13} />{r.label}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ws-ink-mute)', fontSize: 12 }}>
                        <HelpCircle size={13} />{r.label}
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, color: 'var(--ws-ink-soft)' }}>{r.whatToCheck}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

const th: React.CSSProperties = {
  padding: '8px', textAlign: 'left',
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--ws-piq-dark)',
};
const tdName: React.CSSProperties = { padding: '10px 8px', fontSize: 12.5, fontWeight: 500, color: 'var(--ws-ink)' };
const td: React.CSSProperties = { padding: '10px 8px', fontSize: 12.5 };
