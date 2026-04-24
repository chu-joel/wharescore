'use client';

import {
  DollarSign,
  Home,
  Droplets,
  Sun,
  Snowflake,
  AlertTriangle,
  CheckCircle,
  Shield,
  TrendingDown,
  TrendingUp,
  Minus,
  Eye,
} from 'lucide-react';
import { isInFloodZone, isNearFloodZone, isHighOrVeryHighLiquefaction } from '@/lib/hazards';
import type { PropertyReport } from '@/lib/types';

interface Props {
  report: PropertyReport;
}

type Verdict = 'good' | 'ok' | 'caution' | 'warning';

interface SnapshotSection {
  id: string;
  icon: typeof DollarSign;
  title: string;
  detail: string;
  verdict: Verdict;
}

const VERDICT_CONFIG = {
  good: { label: 'Looks good for renters', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-300 dark:border-green-800', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
  ok: { label: 'Reasonable. Check a few things', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', icon: Shield },
  caution: { label: 'Some things to watch out for', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', icon: AlertTriangle },
  warning: { label: 'Significant concerns. Inspect carefully', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-800', text: 'text-red-700 dark:text-red-400', icon: AlertTriangle },
};

const SECTION_DOT = {
  good: 'bg-green-500',
  ok: 'bg-blue-400',
  caution: 'bg-amber-400',
  warning: 'bg-red-500',
};

/**
 * Unified renter snapshot. ONE card that replaces 5 separate cards.
 * Shows an overall verdict + sections for rent, market power, healthy homes,
 * mould/dampness, and sun/aspect. Only shows sections with meaningful data.
 */
export function RenterSnapshot({ report }: Props) {
  const sections: SnapshotSection[] = [];

  // === RENT AFFORDABILITY ===
  const assessment = report.market?.rent_assessment;
  if (assessment?.median) {
    const median = assessment.median;
    const yearlyRent = median * 52;
    const range = assessment.lower_quartile && assessment.upper_quartile
      ? `$${assessment.lower_quartile}–$${assessment.upper_quartile}/wk range`
      : '';
    const bondCount = assessment.bond_count ?? 0;

    sections.push({
      id: 'rent',
      icon: DollarSign,
      title: `$${median}/wk median rent`,
      detail: `${range}${range && bondCount > 0 ? ' · ' : ''}${bondCount > 0 ? `${bondCount} recent bonds` : ''}. That's $${Math.round(yearlyRent).toLocaleString('en-NZ')}/year.`,
      verdict: median <= 500 ? 'good' : median <= 700 ? 'ok' : 'caution',
    });
  }

  // === MARKET POWER ===
  const cagr1 = report.market?.trend?.cagr_1yr;
  const heat = report.market?.market_heat;
  if (cagr1 !== null && cagr1 !== undefined) {
    if (cagr1 <= -3) {
      sections.push({
        id: 'market',
        icon: TrendingDown,
        title: `Rents falling ${Math.abs(cagr1).toFixed(1)}%`,
        detail: 'You have negotiating power. Ask for a lower rent or longer fixed term at current rate.',
        verdict: 'good',
      });
    } else if (cagr1 <= 0) {
      sections.push({
        id: 'market',
        icon: Minus,
        title: 'Rents flat or softening',
        detail: 'Room to negotiate, especially if the listing has been up for 2+ weeks.',
        verdict: 'good',
      });
    } else if (cagr1 <= 3) {
      sections.push({
        id: 'market',
        icon: TrendingUp,
        title: `Rents up ${cagr1.toFixed(1)}% this year`,
        detail: 'Roughly tracking inflation. Less room to negotiate, but still worth asking.',
        verdict: 'ok',
      });
    } else {
      sections.push({
        id: 'market',
        icon: TrendingUp,
        title: `Rents rising ${cagr1.toFixed(1)}%`,
        detail: 'Above inflation. Lock in a fixed term to protect against increases.',
        verdict: 'caution',
      });
    }
  } else if (heat === 'cold' || heat === 'cool') {
    sections.push({
      id: 'market',
      icon: TrendingDown,
      title: 'Cool rental market',
      detail: "More supply than demand. Don't feel pressured; you have options.",
      verdict: 'good',
    });
  }

  // === HEALTHY HOMES ===
  const hazards = report.hazards;
  const environment = report.environment;
  const windZone = String(environment?.wind_zone || '').toUpperCase();
  const hasFlood = isInFloodZone(hazards) || isNearFloodZone(hazards);
  const highLiquefaction = isHighOrVeryHighLiquefaction(hazards);
  const coastalErosion = !!(hazards?.coastal_erosion_exposure);
  const highWind = ['H', 'VH', 'EH', 'SED', 'HIGH', 'VERY HIGH'].includes(windZone);

  const hhFlags: string[] = [];
  if (hasFlood || highLiquefaction || coastalErosion) hhFlags.push('moisture');
  if (highWind) hhFlags.push('draught');

  if (hhFlags.length > 0) {
    // Detail names the specific area exposures so the user understands
    // WHY we're flagging it. Builds dynamically from whichever signals
    // tripped — saying "flood and wind" when only one applied looked
    // sloppy and vague.
    const reasons: string[] = [];
    if (hasFlood) reasons.push('flood zone');
    if (highLiquefaction) reasons.push('high liquefaction');
    if (coastalErosion) reasons.push('coastal erosion');
    if (highWind) reasons.push('high wind exposure');
    const reasonText = reasons.length > 1
      ? reasons.slice(0, -1).join(', ') + ' and ' + reasons.slice(-1)
      : reasons[0] ?? 'area exposure';
    sections.push({
      id: 'healthy-homes',
      icon: Home,
      title: `Healthy Homes: extra checks needed for ${hhFlags.join(' and ')}`,
      detail: `This area's ${reasonText} means ${hhFlags.join(' and ')} ${hhFlags.length > 1 ? 'are' : 'is'} extra worth verifying. Ask for the signed Healthy Homes compliance statement and check seals, ventilation, and dampness at the viewing.`,
      verdict: hhFlags.length >= 2 ? 'caution' : 'ok',
    });
  }

  // === MOULD / DAMPNESS RISK ===
  const terrain = report.terrain;
  const aspect = terrain?.aspect_label;
  const isSouthFacing = aspect === 'S' || aspect === 'SE' || aspect === 'SW';
  const isDepression = terrain?.is_depression && (terrain.depression_depth_m ?? 0) > 0.5;
  const dampFactors: string[] = [];
  if (isSouthFacing) dampFactors.push('limited sun');
  if (hasFlood) dampFactors.push('flood zone');
  if (isDepression) dampFactors.push('low-lying');
  if (highLiquefaction) dampFactors.push('high water table');
  if (coastalErosion) dampFactors.push('coastal exposure');

  // Flood zone is a qualitatively different dampness factor to "limited sun"
  // or "low-lying terrain". rooms that have actually flooded carry long-term
  // mould risk, contents insurance implications, and possible contamination.
  // Always surface it at 'warning' even when it's the only factor.
  const floodAmongFactors = hasFlood && dampFactors.includes('flood zone');
  if (dampFactors.length >= 2 || floodAmongFactors) {
    sections.push({
      id: 'dampness',
      icon: Droplets,
      title: floodAmongFactors ? 'Higher dampness and flood damage risk' : 'Higher dampness risk',
      detail: floodAmongFactors
        ? `${dampFactors.join(', ')}. Past flooding leaves long-term mould in walls, floors and insulation. Check behind wardrobes, under sinks, along skirting boards and in the ceiling space. Ask directly whether this property has been flooded or is on contents-insurance exclusion lists.`
        : `${dampFactors.join(', ')}. Check behind wardrobes and bathroom ceilings for mould. 1 in 5 NZ rentals have dampness issues.`,
      verdict: (dampFactors.length >= 3 || floodAmongFactors) ? 'warning' : 'caution',
    });
  } else if (dampFactors.length === 1) {
    sections.push({
      id: 'dampness',
      icon: Droplets,
      title: 'Minor dampness factor',
      detail: `${dampFactors[0]}. Check for mould during your viewing, but overall risk is low.`,
      verdict: 'ok',
    });
  }

  // === SUN / ASPECT ===
  if (aspect) {
    const isNorth = aspect === 'N' || aspect === 'NE' || aspect === 'NW';
    if (isNorth) {
      sections.push({
        id: 'sun',
        icon: Sun,
        title: `${aspect}-facing: good sun`,
        detail: 'Best orientation in NZ. Warm in winter, lower heating costs.',
        verdict: 'good',
      });
    } else if (isSouthFacing) {
      sections.push({
        id: 'sun',
        icon: Snowflake,
        title: `${aspect}-facing: limited winter sun`,
        detail: 'Expect higher heating costs. Ask about power bills and check for cold spots on walls.',
        verdict: 'caution',
      });
    }
    // E/W. don't show, it's neutral/uninteresting
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

  // Sort sections so concerns come first, then neutral, then good.
  // Prevents "good" rows appearing under a "watch out for" header and looking like warnings.
  sections.sort((a, b) => verdictScores[b.verdict] - verdictScores[a.verdict]);

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
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="flex items-start gap-2.5 rounded-lg bg-card/60 dark:bg-card/30 px-3 py-2.5">
              <span className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${SECTION_DOT[section.verdict]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{section.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{section.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Viewing reminder */}
      <div className="px-4 pb-3 flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          {overall === 'good'
            ? 'Still check insulation, heating, and ventilation at your viewing.'
            : overall === 'warning'
              ? 'Inspect this property carefully. Ask the landlord about every flagged issue.'
              : 'Ask the landlord about flagged items. Scroll down for your personalised viewing checklist.'}
        </p>
      </div>
    </div>
  );
}
