'use client';

import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  HardHat,
  Flame,
  Waves,
  ThermometerSnowflake,
} from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface Props {
  report: PropertyReport;
}

type Verdict = 'good' | 'ok' | 'caution' | 'warning';

interface SnapshotSection {
  id: string;
  title: string;
  detail: string;
  verdict: Verdict;
}

const VERDICT_CONFIG = {
  good: { label: 'Low risk — strong fundamentals', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-300 dark:border-green-800', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
  ok: { label: 'Moderate risk — investigate these areas', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', icon: Shield },
  caution: { label: 'Elevated risk — due diligence critical', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', icon: AlertTriangle },
  warning: { label: 'High risk — proceed with extreme caution', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-800', text: 'text-red-700 dark:text-red-400', icon: AlertTriangle },
};

const SECTION_DOT = {
  good: 'bg-green-500',
  ok: 'bg-blue-400',
  caution: 'bg-amber-400',
  warning: 'bg-red-500',
};

/**
 * Unified buyer snapshot — ONE card that replaces BuyerPropertyInsights.
 * Covers: insurability, building era risk, ownership costs, renovation potential,
 * climate/managed retreat, capital growth.
 */
export function BuyerSnapshot({ report }: Props) {
  const sections: SnapshotSection[] = [];
  const hazards = report.hazards;
  const planning = report.planning;
  const property = report.property;
  const terrain = report.terrain;

  // === INSURABILITY ASSESSMENT ===
  if (hazards) {
    const flags: string[] = [];
    const isFlood = !!(hazards.flood_zone || hazards.flood_extent_label);
    const liqStr = String(hazards.liquefaction_zone || '').toLowerCase();
    const isHighLiq = liqStr.includes('high') || liqStr.includes('very');
    const isTsunami = !!hazards.tsunami_zone;
    const isEPB = planning?.epb_listed;
    const isCoastalErosion = !!(hazards.coastal_erosion_exposure);
    const slopeStr = String(hazards.slope_failure || '').toLowerCase();
    const isHighSlope = slopeStr.includes('high') || slopeStr.includes('very');

    if (isFlood) flags.push('flood zone');
    if (isHighLiq) flags.push('liquefaction');
    if (isEPB) flags.push('earthquake-prone');
    if (isCoastalErosion) flags.push('coastal erosion');
    if (isHighSlope) flags.push('slope failure');
    if (isTsunami) flags.push('tsunami zone');

    if (flags.length >= 3 || isEPB) {
      sections.push({
        id: 'insurance',
        title: `Insurance: difficult — ${flags.slice(0, 3).join(', ')}`,
        detail: 'Multiple hazards. Some insurers may decline or set high excesses. Get quotes BEFORE going unconditional. EQC covers first $300K of earthquake damage — check the gap.',
        verdict: 'warning',
      });
    } else if (flags.length >= 1) {
      sections.push({
        id: 'insurance',
        title: `Insurance: ${flags.join(', ')} flagged`,
        detail: 'Expect higher premiums. Compare at least 3 insurers and get quotes before going unconditional.',
        verdict: flags.length >= 2 ? 'caution' : 'ok',
      });
    } else {
      sections.push({
        id: 'insurance',
        title: 'Insurance: no hazard flags',
        detail: 'No natural hazards flagged that typically increase premiums or limit cover.',
        verdict: 'good',
      });
    }
  }

  // === BUILDING ERA RISK ===
  // Use CV date as a proxy for building age (imperfect but best available)
  // Also check EPB construction type for old masonry buildings
  const epbType = hazards?.epb_construction_type;
  const isOldMasonry = epbType && (epbType.toLowerCase().includes('unreinforced') || epbType.toLowerCase().includes('masonry'));

  if (planning?.epb_listed) {
    sections.push({
      id: 'era',
      title: `Building: earthquake-prone${isOldMasonry ? ` (${epbType})` : ''}`,
      detail: 'On the MBIE EPB register. Strengthening or demolition required within set timeframe. Cost: $800–$3,000/m². Check the deadline and any existing engineering assessments.',
      verdict: 'warning',
    });
  } else if (isOldMasonry) {
    sections.push({
      id: 'era',
      title: `Older construction: ${epbType}`,
      detail: 'Not EPB-listed, but older construction type. Get a structural assessment. Pre-1990 buildings may contain asbestos — test before any renovation.',
      verdict: 'caution',
    });
  }

  // === RENOVATION / DEVELOPMENT POTENTIAL ===
  if (planning) {
    const hasHeritage = (planning.heritage_count ?? 0) > 0 || planning.in_heritage_overlay;
    const hasCharacter = planning.in_character_precinct || planning.in_special_character_area;
    const hasViewshaft = planning.in_viewshaft;
    const hasEcological = planning.in_ecological_area;
    const heightLimit = planning.height_limit;
    const restrictionCount = [hasHeritage, hasCharacter, hasViewshaft, hasEcological].filter(Boolean).length;

    if (restrictionCount >= 2) {
      sections.push({
        id: 'development',
        title: 'Development: restricted — multiple overlays',
        detail: `${[hasHeritage && 'heritage', hasCharacter && 'character area', hasViewshaft && 'viewshaft', hasEcological && 'ecological area'].filter(Boolean).join(', ')}. Resource consent required for most external changes.`,
        verdict: 'caution',
      });
    } else if (hasHeritage || hasCharacter) {
      sections.push({
        id: 'development',
        title: 'Development: limited by heritage/character controls',
        detail: 'External modifications require resource consent. Internal renovations generally OK.',
        verdict: 'ok',
      });
    } else if (heightLimit && heightLimit >= 14) {
      sections.push({
        id: 'development',
        title: `Development: good potential — ${heightLimit}m height limit`,
        detail: 'No major planning overlays. Zone allows higher density. Subdivision or second dwelling may be feasible.',
        verdict: 'good',
      });
    }
  }

  // === CLIMATE / MANAGED RETREAT RISK ===
  const elevation = terrain?.elevation_m;
  const coastalElev = hazards?.coastal_elevation_cm;
  const isCoastal = coastalElev != null && coastalElev < 500;
  const isVeryLow = coastalElev != null && coastalElev < 200;
  const hasFlood = !!(hazards?.flood_zone || hazards?.flood_extent_label);
  const hasCoastalErosion = !!(hazards?.coastal_erosion_exposure);

  if (isVeryLow && (hasFlood || hasCoastalErosion)) {
    sections.push({
      id: 'climate',
      title: `Climate risk: only ${(coastalElev! / 100).toFixed(1)}m above sea level`,
      detail: 'Low-lying coastal property with existing hazard flags. At +0.5m sea level rise, flood risk increases significantly. Check council climate adaptation plans — managed retreat may apply.',
      verdict: 'warning',
    });
  } else if (isCoastal && hasCoastalErosion) {
    sections.push({
      id: 'climate',
      title: 'Climate risk: coastal erosion zone',
      detail: 'Within a mapped coastal erosion projection area. May affect long-term property value and insurability. No NZ legislation yet provides compensation for managed retreat.',
      verdict: 'caution',
    });
  }

  // === CAPITAL GROWTH / MARKET TRAJECTORY ===
  const cagr5 = report.market?.trend?.cagr_5yr;
  const cagr1 = report.market?.trend?.cagr_1yr;
  if (cagr5 !== null && cagr5 !== undefined) {
    if (cagr5 >= 4) {
      sections.push({
        id: 'growth',
        title: `Rent growth: strong — ${cagr5.toFixed(1)}%/yr over 5 years`,
        detail: 'Above-inflation rental growth supports yield. Good signal for capital value trajectory.',
        verdict: 'good',
      });
    } else if (cagr5 < 0) {
      sections.push({
        id: 'growth',
        title: `Rent growth: declining — ${cagr5.toFixed(1)}%/yr over 5 years`,
        detail: 'Rents have fallen over 5 years. May indicate area challenges or oversupply.',
        verdict: 'caution',
      });
    }
  } else if (cagr1 !== null && cagr1 !== undefined && (cagr1 >= 5 || cagr1 <= -3)) {
    sections.push({
      id: 'growth',
      title: cagr1 >= 0 ? `Rent trend: up ${cagr1.toFixed(1)}% this year` : `Rent trend: down ${Math.abs(cagr1).toFixed(1)}% this year`,
      detail: cagr1 >= 0 ? 'Strong rental demand supports investment case.' : 'Falling rents — investigate whether temporary or structural.',
      verdict: cagr1 >= 3 ? 'good' : 'caution',
    });
  }

  // === TITLE TYPE (cross-lease warning) ===
  const titleRef = property.title_ref;
  // Cross-leases in NZ typically have title refs containing "CL" or the property detection may indicate
  // For now, check if multi-unit on a shared title
  const isMultiUnit = report.property_detection?.is_multi_unit;
  const unitCount = report.property_detection?.unit_count ?? 0;
  if (isMultiUnit && unitCount >= 2) {
    sections.push({
      id: 'title',
      title: `Multi-unit: ${unitCount} units on this site`,
      detail: 'Check title type (cross-lease, unit title, or freehold). If cross-lease: verify flats plan is current — 50% of NZ cross-leases are technically defective. If unit title: request body corporate records and LTMP.',
      verdict: 'ok',
    });
  }

  // === CALCULATE OVERALL VERDICT ===
  const verdictScores = { good: 0, ok: 1, caution: 2, warning: 3 };
  const maxScore = Math.max(...sections.map(s => verdictScores[s.verdict]), 0);
  const cautionCount = sections.filter(s => s.verdict === 'caution' || s.verdict === 'warning').length;

  let overall: Verdict;
  if (maxScore >= 3 || cautionCount >= 3) overall = 'warning';
  else if (maxScore >= 2 || cautionCount >= 2) overall = 'caution';
  else if (cautionCount >= 1) overall = 'ok';
  else overall = 'good';

  const config = VERDICT_CONFIG[overall];
  const VerdictIcon = config.icon;

  if (sections.length === 0) return null;

  return (
    <div className={`rounded-xl border-2 ${config.border} ${config.bg} overflow-hidden`}>
      {/* Overall verdict header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <VerdictIcon className={`h-5 w-5 ${config.text}`} />
          <p className={`text-sm font-bold ${config.text}`}>{config.label}</p>
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 pb-4 space-y-2.5">
        {sections.map((section) => (
          <div key={section.id} className="flex items-start gap-2.5 rounded-lg bg-card/60 dark:bg-card/30 px-3 py-2.5">
            <span className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${SECTION_DOT[section.verdict]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{section.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{section.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-4 pb-3">
        <p className="text-xs text-muted-foreground">
          {overall === 'good'
            ? 'Standard due diligence recommended. See your personalised checklist below.'
            : 'Thorough due diligence essential. See your personalised checklist below for specific recommendations.'}
        </p>
      </div>
    </div>
  );
}
