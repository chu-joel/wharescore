'use client';

import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface Props {
  report: PropertyReport;
}

interface HHRow {
  area: string;
  status: 'ok' | 'flagged' | 'unknown';
  label: string;
  whatToCheck: string;
}

export function HostedHealthyHomes({ report }: Props) {
  const hazards = (report as unknown as Record<string, unknown>).hazards as Record<string, unknown> | undefined;
  if (!hazards) return null;

  const windZone = String(hazards.wind_zone || '').toUpperCase();
  const hasFlood = !!(hazards.flood_zone || hazards.flood_overlay);
  const highLiquefaction = String(hazards.liquefaction_class || '').toLowerCase().includes('high');
  const coastalErosion = !!(hazards.coastal_erosion_risk);

  const rows: HHRow[] = [
    {
      area: 'Heating',
      status: 'unknown',
      label: 'No issues detected',
      whatToCheck: 'Fixed heater capable of ≥1.5kW in main living area',
    },
    {
      area: 'Insulation',
      status: 'unknown',
      label: 'No issues detected',
      whatToCheck: 'Ceiling ≥R2.9, underfloor ≥R1.3',
    },
    {
      area: 'Ventilation',
      status: 'unknown',
      label: 'No issues detected',
      whatToCheck: 'Extractor fans in kitchen & bathroom vent to outside',
    },
    {
      area: 'Moisture',
      status: (hasFlood || highLiquefaction || coastalErosion) ? 'flagged' : 'unknown',
      label: (hasFlood || highLiquefaction || coastalErosion)
        ? `⚠ Flagged — ${[hasFlood && 'flood zone', highLiquefaction && 'high liquefaction', coastalErosion && 'coastal erosion'].filter(Boolean).join(', ')}`
        : 'No issues detected',
      whatToCheck: 'No visible mould, condensation, or rising damp',
    },
    {
      area: 'Draught',
      status: (windZone === 'H' || windZone === 'VH' || windZone === 'HIGH' || windZone === 'VERY HIGH') ? 'flagged' : 'unknown',
      label: (windZone === 'H' || windZone === 'VH' || windZone === 'HIGH' || windZone === 'VERY HIGH')
        ? `⚠ Flagged — Wind zone ${windZone} — higher draught risk`
        : 'No issues detected',
      whatToCheck: 'Window and door seals intact, no draughts',
    },
  ];

  const flaggedCount = rows.filter((r) => r.status === 'flagged').length;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">Healthy Homes Assessment</h3>
        {flaggedCount > 0 && (
          <span className="text-xs text-piq-accent-warm font-medium">{flaggedCount} flagged</span>
        )}
      </div>
      <div className="px-5 pb-5">
        <p className="text-xs text-muted-foreground mb-3">
          Landlords must comply with Healthy Homes Standards. Check these areas during viewing.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 text-xs font-semibold text-piq-primary uppercase tracking-wider">Area</th>
                <th className="text-left py-2 pr-3 text-xs font-semibold text-piq-primary uppercase tracking-wider">Status</th>
                <th className="text-left py-2 text-xs font-semibold text-piq-primary uppercase tracking-wider">What to Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.area} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{row.area}</td>
                  <td className="py-2.5 pr-3">
                    {row.status === 'flagged' ? (
                      <span className="inline-flex items-center gap-1 text-piq-accent-warm text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {row.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-piq-success text-xs">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {row.label}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-muted-foreground text-xs">{row.whatToCheck}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
