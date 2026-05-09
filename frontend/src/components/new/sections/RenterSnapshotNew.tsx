'use client';

import { Home, DollarSign, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { getFloodTier, isHighOrVeryHighLiquefaction } from '@/lib/hazards';
import { Card, CardHead, SeverityTag, type Severity } from '@/components/new/ui/primitives';

type Verdict = 'good' | 'ok' | 'caution' | 'warning';

const SEV_FOR: Record<Verdict, Severity> = {
  good: 'good',
  ok: 'info',
  caution: 'warn',
  warning: 'crit',
};

interface RenterSection {
  id: string;
  title: string;
  detail: string;
  verdict: Verdict;
  icon: React.ReactNode;
}

/**
 * Renter snapshot — the renter-persona surface inside PropertyReportNew.
 * Mirrors the classic RenterSnapshot's ranked sections (rent, market power,
 * healthy homes, mould risk) in the new finding-row design.
 */
export function RenterSnapshotNew({ report }: { report: PropertyReport }) {
  const sections = buildSections(report);
  if (sections.length === 0) return null;

  return (
    <Card>
      <CardHead title="Renter snapshot" meta={`${sections.length} signals`} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 8 }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {sections.map((s) => {
            const sev = SEV_FOR[s.verdict];
            return (
              <li key={s.id} className={`ws-finding ${sev}`} style={{ padding: '12px 14px' }}>
                <div className="ico" aria-hidden="true">{s.icon}</div>
                <div>
                  <strong>
                    {s.title}
                    <SeverityTag severity={sev} />
                  </strong>
                  <p>{s.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

function buildSections(report: PropertyReport): RenterSection[] {
  const out: RenterSection[] = [];

  // === RENT MEDIAN ===
  const assessment = report.market?.rent_assessment;
  const median = assessment?.median;
  if (median != null && median > 0) {
    const yearly = median * 52;
    const range = assessment?.lower_quartile && assessment?.upper_quartile
      ? `$${assessment.lower_quartile}–$${assessment.upper_quartile}/wk range`
      : '';
    const bonds = assessment?.bond_count ?? 0;
    out.push({
      id: 'rent',
      title: `$${median}/wk median rent`,
      detail: `${range}${range && bonds > 0 ? ' · ' : ''}${bonds > 0 ? `${bonds} recent bonds` : ''}. That's $${Math.round(yearly).toLocaleString('en-NZ')}/year.`,
      verdict: median <= 500 ? 'good' : median <= 700 ? 'ok' : 'caution',
      icon: <DollarSign size={14} />,
    });
  }

  // === MARKET POWER ===
  const cagr1 = report.market?.trend?.cagr_1yr;
  const heat = report.market?.market_heat;
  if (cagr1 != null) {
    if (cagr1 <= -3) {
      out.push({
        id: 'market',
        title: `Rents falling ${Math.abs(cagr1).toFixed(1)}%`,
        detail: 'You have negotiating power. Ask for a lower rent or a longer fixed term at the current rate.',
        verdict: 'good',
        icon: <TrendingDown size={14} />,
      });
    } else if (cagr1 <= 0) {
      out.push({
        id: 'market',
        title: 'Rents flat or softening',
        detail: 'Room to negotiate, especially if the listing has been up for 2+ weeks.',
        verdict: 'good',
        icon: <Minus size={14} />,
      });
    } else if (cagr1 <= 3) {
      out.push({
        id: 'market',
        title: `Rents up ${cagr1.toFixed(1)}% this year`,
        detail: 'Roughly tracking inflation. Less room to negotiate, but still worth asking.',
        verdict: 'ok',
        icon: <TrendingUp size={14} />,
      });
    } else {
      out.push({
        id: 'market',
        title: `Rents rising ${cagr1.toFixed(1)}%`,
        detail: 'Above inflation. Lock in a fixed term to protect against increases.',
        verdict: 'caution',
        icon: <TrendingUp size={14} />,
      });
    }
  } else if (heat === 'cold' || heat === 'cool') {
    out.push({
      id: 'market',
      title: 'Cool rental market',
      detail: "More supply than demand. Don't feel pressured; you have options.",
      verdict: 'good',
      icon: <TrendingDown size={14} />,
    });
  }

  // === HEALTHY HOMES ===
  const hazards = report.hazards;
  const environment = report.environment;
  const windZone = String(environment?.wind_zone || '').toUpperCase();
  const floodTier = getFloodTier(hazards);
  const hasFlood = floodTier === 'severe' || floodTier === 'moderate';
  const highLiq = isHighOrVeryHighLiquefaction(hazards);
  const coastalErosion = !!(hazards?.coastal_erosion_exposure);
  const highWind = ['H', 'VH', 'EH', 'SED', 'HIGH', 'VERY HIGH'].includes(windZone);

  const hhFlags: string[] = [];
  if (hasFlood || highLiq || coastalErosion) hhFlags.push('moisture');
  if (highWind) hhFlags.push('draught');

  if (hhFlags.length > 0) {
    const reasons: string[] = [];
    if (hasFlood) reasons.push('flood zone');
    if (highLiq) reasons.push('high liquefaction');
    if (coastalErosion) reasons.push('coastal erosion');
    if (highWind) reasons.push('high wind exposure');
    const reasonText = reasons.length > 1
      ? reasons.slice(0, -1).join(', ') + ' and ' + reasons.slice(-1)
      : reasons[0] ?? 'area exposure';
    out.push({
      id: 'healthy-homes',
      title: `Healthy Homes: extra checks for ${hhFlags.join(' and ')}`,
      detail: `This area's ${reasonText} means ${hhFlags.join(' and ')} ${hhFlags.length > 1 ? 'are' : 'is'} worth verifying. Ask for the signed Healthy Homes compliance statement; check seals, ventilation, and dampness during the viewing.`,
      verdict: hhFlags.length >= 2 ? 'caution' : 'ok',
      icon: <Home size={14} />,
    });
  }

  // === MOULD / DAMPNESS PROXY ===
  const terrain = report.terrain;
  const aspect = terrain?.aspect_label as string | undefined;
  const southFacing = aspect === 'S' || aspect === 'SE' || aspect === 'SW';
  const depression = terrain?.is_depression && (terrain.depression_depth_m ?? 0) > 0.5;
  const dampFactors: string[] = [];
  if (southFacing) dampFactors.push('limited sun');
  if (hasFlood) dampFactors.push('flood zone');
  if (depression) dampFactors.push('low-lying');
  if (dampFactors.length >= 2) {
    out.push({
      id: 'mould',
      title: `Mould risk: ${dampFactors.join(', ')}`,
      detail: 'Combination of factors raises dampness risk. Inspect bedrooms and bathrooms for staining; ask whether ventilation has been upgraded.',
      verdict: 'caution',
      icon: <AlertTriangle size={14} />,
    });
  }

  return out;
}
