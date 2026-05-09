'use client';

import { Shield, AlertTriangle, CheckCircle, Building2, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import {
  isInFloodZone,
  isNearFloodZone,
  floodProximityM,
  isInTsunamiZone,
  hasHighCoastalErosionRisk,
  hasHighWildfireRisk,
  isInLandslideRisk,
  isHighOrVeryHighLiquefaction,
} from '@/lib/hazards';
import { Card, CardHead, SeverityTag, type Severity } from '@/components/new/ui/primitives';

type Verdict = 'good' | 'ok' | 'caution' | 'warning';

interface SnapshotSection {
  id: string;
  title: string;
  detail: string;
  verdict: Verdict;
  icon: React.ReactNode;
}

const SEV_FOR: Record<Verdict, Severity> = {
  good: 'good',
  ok: 'info',
  caution: 'warn',
  warning: 'crit',
};

/**
 * Buyer snapshot in the new design system. Renders the same 5-7 derived
 * sections as classic BuyerSnapshot (insurability, building era, development
 * potential, climate, capital growth, title type) but in the new finding-row
 * style with severity-glyph + keyword + colour.
 *
 * Logic copied from classic; if we change the rules in classic this file
 * needs to keep up. Long term we extract into lib/buyerSnapshot.ts and
 * share between both.
 */
export function BuyerSnapshotNew({ report }: { report: PropertyReport }) {
  const hazards = report.hazards;
  const planning = report.planning;
  const sections = buildSections(report);

  if (sections.length === 0) return null;

  // Overall verdict
  const score: Record<Verdict, number> = { good: 0, ok: 1, caution: 2, warning: 3 };
  const maxScore = Math.max(...sections.map((s) => score[s.verdict]), 0);
  const cautionCount = sections.filter((s) => s.verdict === 'caution' || s.verdict === 'warning').length;
  let overall: Verdict;
  if (maxScore >= 3 || cautionCount >= 3) overall = 'warning';
  else if (maxScore >= 2 || cautionCount >= 2) overall = 'caution';
  else if (cautionCount >= 1) overall = 'ok';
  else overall = 'good';

  const headlineCopy: Record<Verdict, string> = {
    good: 'Strong fundamentals. Standard checks apply.',
    ok: 'A few areas to look closer at.',
    caution: 'Worth extra due diligence before offering.',
    warning: 'Significant concerns. Get professional advice.',
  };
  const HeadlineIcon = overall === 'good' ? CheckCircle : overall === 'warning' ? AlertTriangle : Shield;

  void hazards; void planning; // silence unused-vars TS hint when shape changes

  return (
    <Card>
      <CardHead title="Buyer snapshot" meta={`${sections.length} signals`} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 12 }}>
        {/* Overall verdict line */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px',
          borderRadius: 'var(--ws-radius)',
          background: overall === 'warning' ? 'rgba(196,45,45,.06)'
                     : overall === 'caution' ? 'rgba(213,94,0,.06)'
                     : overall === 'ok'      ? 'rgba(13,115,119,.06)'
                                              : 'rgba(45,106,79,.06)',
          border: '1px solid var(--ws-rule)',
          fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)',
        }}>
          <HeadlineIcon size={16} style={{
            color: overall === 'warning' ? 'var(--ws-r-vhigh)'
                  : overall === 'caution' ? 'var(--ws-r-high)'
                  : overall === 'ok'      ? 'var(--ws-piq)'
                                            : 'var(--ws-success)',
          }} />
          {headlineCopy[overall]}
        </div>

        {/* Section rows */}
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

function buildSections(report: PropertyReport): SnapshotSection[] {
  const out: SnapshotSection[] = [];
  const hazards = report.hazards;
  const planning = report.planning;

  // === INSURABILITY ===
  if (hazards) {
    const flags: string[] = [];
    if (isInFloodZone(hazards)) flags.push('flood zone');
    else if (isNearFloodZone(hazards)) flags.push(`close to flood zone (${floodProximityM(hazards)} m)`);
    if (isHighOrVeryHighLiquefaction(hazards)) flags.push('liquefaction');
    if (planning?.epb_listed) flags.push('earthquake-prone');
    if (hasHighCoastalErosionRisk(hazards)) flags.push('coastal erosion');
    const slope = String(hazards.slope_failure ?? hazards.council_slope_severity ?? '').toLowerCase();
    if (slope.includes('high') || slope.includes('very')) flags.push('slope failure');
    if (isInTsunamiZone(hazards)) flags.push('tsunami zone');
    if (isInLandslideRisk(hazards)) flags.push('landslide risk');
    if (hasHighWildfireRisk(hazards)) flags.push('wildfire risk');

    if (flags.length >= 3 || planning?.epb_listed) {
      out.push({
        id: 'insurance',
        title: `Insurance difficult: ${flags.slice(0, 3).join(', ')}`,
        detail: 'Multiple hazards. Some insurers may decline or set high excesses. Get quotes BEFORE going unconditional.',
        verdict: 'warning',
        icon: <Shield size={14} />,
      });
    } else if (flags.length >= 1) {
      out.push({
        id: 'insurance',
        title: `Insurance: ${flags.join(', ')} flagged`,
        detail: 'Expect higher premiums. Compare at least 3 insurers and quote before going unconditional.',
        verdict: flags.length >= 2 ? 'caution' : 'ok',
        icon: <Shield size={14} />,
      });
    } else {
      out.push({
        id: 'insurance',
        title: 'Insurance: no hazard flags',
        detail: 'No natural hazards flagged that typically increase premiums or limit cover.',
        verdict: 'good',
        icon: <Shield size={14} />,
      });
    }
  }

  // === BUILDING ERA ===
  const epbType = hazards?.epb_construction_type as string | undefined;
  const isOldMasonry = epbType && (/(unreinforced|masonry)/i.test(epbType));
  if (planning?.epb_listed) {
    out.push({
      id: 'era',
      title: `Building: earthquake-prone${isOldMasonry ? ` (${epbType})` : ''}`,
      detail: 'On the MBIE EPB register. Strengthening or demolition required. Cost $800–$3,000/m². Check the deadline and any engineering assessments.',
      verdict: 'warning',
      icon: <Building2 size={14} />,
    });
  } else if (isOldMasonry) {
    out.push({
      id: 'era',
      title: `Older construction: ${epbType}`,
      detail: 'Not EPB-listed, but older construction type. Get a structural assessment. Pre-1990 buildings may contain asbestos.',
      verdict: 'caution',
      icon: <Building2 size={14} />,
    });
  }

  // === DEVELOPMENT ===
  if (planning) {
    const hasHeritage = (planning.heritage_count ?? 0) > 0 || planning.in_heritage_overlay;
    const hasCharacter = planning.in_character_precinct || planning.in_special_character_area;
    const hasViewshaft = planning.in_viewshaft;
    const hasEcological = planning.in_ecological_area;
    const heightLimit = planning.height_limit;
    const restrictions = [hasHeritage, hasCharacter, hasViewshaft, hasEcological].filter(Boolean).length;

    if (restrictions >= 2) {
      const list = [
        hasHeritage && 'heritage',
        hasCharacter && 'character area',
        hasViewshaft && 'viewshaft',
        hasEcological && 'ecological area',
      ].filter(Boolean).join(', ');
      out.push({
        id: 'development',
        title: 'Development restricted: multiple overlays',
        detail: `${list}. Resource consent required for most external changes.`,
        verdict: 'caution',
        icon: <Layers size={14} />,
      });
    } else if (hasHeritage || hasCharacter) {
      out.push({
        id: 'development',
        title: 'Development: limited by heritage / character controls',
        detail: 'External modifications require resource consent. Internal renovations generally OK.',
        verdict: 'ok',
        icon: <Layers size={14} />,
      });
    } else if (heightLimit && heightLimit >= 14) {
      out.push({
        id: 'development',
        title: `Development potential: ${heightLimit} m height limit`,
        detail: 'No major planning overlays. Zone allows higher density. Subdivision or second dwelling may be feasible.',
        verdict: 'good',
        icon: <Layers size={14} />,
      });
    }
  }

  // === MARKET TRAJECTORY ===
  const cagr5 = report.market?.trend?.cagr_5yr;
  const cagr1 = report.market?.trend?.cagr_1yr;
  if (cagr5 != null) {
    if (cagr5 >= 4) {
      out.push({
        id: 'growth',
        title: `Rent growth strong: ${cagr5.toFixed(1)}%/yr over 5 years`,
        detail: 'Above-inflation rental growth supports yield. Good signal for capital value trajectory.',
        verdict: 'good',
        icon: <TrendingUp size={14} />,
      });
    } else if (cagr5 < 0) {
      out.push({
        id: 'growth',
        title: `Rent growth declining: ${cagr5.toFixed(1)}%/yr over 5 years`,
        detail: 'Rents have fallen over 5 years. May indicate area challenges or oversupply.',
        verdict: 'caution',
        icon: <TrendingDown size={14} />,
      });
    }
  } else if (cagr1 != null && (cagr1 >= 5 || cagr1 <= -3)) {
    const up = cagr1 >= 0;
    out.push({
      id: 'growth',
      title: up ? `Rent trend: up ${cagr1.toFixed(1)}% this year` : `Rent trend: down ${Math.abs(cagr1).toFixed(1)}% this year`,
      detail: up ? 'Strong rental demand supports investment case.' : 'Falling rents. Investigate whether temporary or structural.',
      verdict: up ? 'good' : 'caution',
      icon: up ? <TrendingUp size={14} /> : <TrendingDown size={14} />,
    });
  }

  // === MULTI-UNIT TITLE ===
  const isMulti = report.property_detection?.is_multi_unit;
  const unitCount = report.property_detection?.unit_count ?? 0;
  if (isMulti && unitCount >= 2) {
    out.push({
      id: 'title',
      title: `Multi-unit: ${unitCount} units on this site`,
      detail: 'Check title type (cross-lease, unit title, or freehold). 50% of NZ cross-leases are technically defective; for unit titles, request body corporate records and LTMP.',
      verdict: 'ok',
      icon: <Layers size={14} />,
    });
  }

  return out;
}
