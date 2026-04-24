'use client';

import { AlertTriangle, HelpCircle } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { getFloodTier, type FloodTier } from '@/lib/hazards';

interface Props {
  report: PropertyReport;
}

interface HHRow {
  area: string;
  status: 'flagged' | 'unverified';
  label: string;
  whatToCheck: string;
}

// The Healthy Homes Standards (heating / insulation / ventilation / moisture / draught-stopping)
// cannot be verified from public data. a renter has to check these at viewing or demand the
// compliance statement. Previous copy said "No issues detected" with a green tick, which
// misleadingly implied verification. We now show "Not verified" for every area we can't measure
// from data, and only flag Moisture / Draught when hazard/wind data gives us a reason to.
const UNVERIFIED_LABEL = 'Not verified. ask at viewing';

export function HostedHealthyHomes({ report }: Props) {
  const hazards = (report as unknown as Record<string, unknown>).hazards as Record<string, unknown> | undefined;
  if (!hazards) return null;

  const windZone = String(hazards.wind_zone || '').toUpperCase();
  // Use the tiered flood signal instead of "any flood data present". Low /
  // nearby tiers no longer cause a Healthy Homes Moisture flag in the
  // hosted table — they're surfaced elsewhere with appropriate context.
  // See lib/hazards.ts getFloodTier.
  const floodTier = getFloodTier(hazards as Parameters<typeof getFloodTier>[0]);
  const floodFlagged = floodTier === 'severe' || floodTier === 'moderate';
  const highLiquefaction = String(hazards.liquefaction_zone || hazards.liquefaction || '').toLowerCase().includes('high');
  const coastalErosion = !!(hazards.coastal_erosion || hazards.coastal_erosion_exposure || hazards.coastal_exposure);
  const moistureFlagged = floodFlagged || highLiquefaction || coastalErosion;
  const windFlagged = windZone === 'H' || windZone === 'VH' || windZone === 'HIGH' || windZone === 'VERY HIGH';

  const floodFlagText = (() => {
    switch (floodTier as FloodTier) {
      case 'severe':   return 'high-risk flood zone';
      case 'moderate': return 'moderate flood zone';
      default:         return null;
    }
  })();

  const rows: HHRow[] = [
    {
      area: 'Heating',
      status: 'unverified',
      label: UNVERIFIED_LABEL,
      whatToCheck: 'Fixed heater capable of ≥1.5kW in main living area',
    },
    {
      area: 'Insulation',
      status: 'unverified',
      label: UNVERIFIED_LABEL,
      whatToCheck: 'Ceiling ≥R2.9, underfloor ≥R1.3',
    },
    {
      area: 'Ventilation',
      status: 'unverified',
      label: UNVERIFIED_LABEL,
      whatToCheck: 'Extractor fans in kitchen & bathroom vent to outside',
    },
    {
      area: 'Moisture',
      status: moistureFlagged ? 'flagged' : 'unverified',
      label: moistureFlagged
        ? `⚠ Area hazard. ${[floodFlagText, highLiquefaction && 'high liquefaction', coastalErosion && 'coastal erosion'].filter(Boolean).join(', ')}`
        : UNVERIFIED_LABEL,
      whatToCheck: 'No visible mould, condensation, or rising damp',
    },
    {
      area: 'Draught',
      status: windFlagged ? 'flagged' : 'unverified',
      label: windFlagged
        ? `⚠ Wind zone ${windZone}. higher draught risk`
        : UNVERIFIED_LABEL,
      whatToCheck: 'Window and door seals intact, no draughts',
    },
  ];

  const flaggedCount = rows.filter((r) => r.status === 'flagged').length;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">Healthy Homes Assessment</h3>
        {flaggedCount > 0 && (
          <span className="text-xs text-piq-accent-warm font-medium">{flaggedCount} area flagged</span>
        )}
      </div>
      <div className="px-5 pb-5">
        <p className="text-xs text-muted-foreground mb-3">
          The Healthy Homes Standards can only be verified in person. Use this as a checklist at the viewing
          and ask your landlord for the signed compliance statement (legally required since July 2025).
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
                      <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                        <HelpCircle className="h-3.5 w-3.5" />
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
