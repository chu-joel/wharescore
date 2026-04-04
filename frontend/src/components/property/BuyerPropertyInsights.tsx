'use client';

import {
  Building2,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HardHat,
} from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface Props {
  report: PropertyReport;
}

interface InsightItem {
  icon: typeof Building2;
  label: string;
  value: string;
  variant: 'good' | 'caution' | 'warning' | 'neutral';
}

/**
 * Buyer-specific property insights card.
 * Combines:
 * - Renovation potential (from planning data)
 * - Insurance quotability (from hazard combinations)
 * - Capital growth trajectory (from market trend data)
 */
export function BuyerPropertyInsights({ report }: Props) {
  const insights: InsightItem[] = [];

  // === RENOVATION POTENTIAL ===
  const planning = report.planning;
  if (planning) {
    const hasHeritage = (planning.heritage_count ?? 0) > 0 || planning.in_heritage_overlay;
    const hasCharacter = planning.in_character_precinct || planning.in_special_character_area;
    const hasViewshaft = planning.in_viewshaft;
    const hasEcological = planning.in_ecological_area;
    const heightLimit = planning.height_limit;
    const restrictionCount = [hasHeritage, hasCharacter, hasViewshaft, hasEcological].filter(Boolean).length;

    if (restrictionCount >= 2) {
      insights.push({
        icon: HardHat,
        label: 'Renovation potential',
        value: 'Restricted — multiple planning overlays limit changes',
        variant: 'warning',
      });
    } else if (hasHeritage || hasCharacter) {
      insights.push({
        icon: HardHat,
        label: 'Renovation potential',
        value: 'Limited — heritage or character area restrictions apply',
        variant: 'caution',
      });
    } else if (heightLimit && heightLimit >= 14) {
      insights.push({
        icon: HardHat,
        label: 'Renovation potential',
        value: `Good — ${heightLimit}m height limit, no major restrictions`,
        variant: 'good',
      });
    } else if (heightLimit && heightLimit >= 8) {
      insights.push({
        icon: HardHat,
        label: 'Renovation potential',
        value: `Moderate — ${heightLimit}m height limit`,
        variant: 'neutral',
      });
    } else {
      insights.push({
        icon: HardHat,
        label: 'Renovation potential',
        value: restrictionCount === 0 ? 'No major restrictions identified' : 'Some restrictions apply',
        variant: restrictionCount === 0 ? 'good' : 'caution',
      });
    }
  }

  // === INSURANCE QUOTABILITY ===
  const hazards = report.hazards;
  if (hazards) {
    const flags: string[] = [];
    const isFlood = !!(hazards.flood_zone || hazards.flood_extent_label);
    const liqStr = String(hazards.liquefaction_zone || '').toLowerCase();
    const isHighLiquefaction = liqStr.includes('high') || liqStr.includes('very');
    const isTsunami = !!hazards.tsunami_zone;
    const isEPB = report.planning?.epb_listed;
    const isCoastalErosion = !!(hazards.coastal_erosion_exposure);
    const slopeStr = String(hazards.slope_failure || '').toLowerCase();
    const isSlopeFailure = slopeStr.includes('high') || slopeStr.includes('very');

    if (isFlood) flags.push('flood');
    if (isHighLiquefaction) flags.push('liquefaction');
    if (isEPB) flags.push('EPB');
    if (isCoastalErosion) flags.push('coastal erosion');
    if (isSlopeFailure) flags.push('slope failure');
    if (isTsunami) flags.push('tsunami');

    if (flags.length >= 3 || isEPB) {
      insights.push({
        icon: Shield,
        label: 'Insurance',
        value: `Difficult — ${flags.slice(0, 3).join(', ')}${flags.length > 3 ? ` +${flags.length - 3} more` : ''}. Get quotes early.`,
        variant: 'warning',
      });
    } else if (flags.length >= 1) {
      insights.push({
        icon: Shield,
        label: 'Insurance',
        value: `May cost more — ${flags.join(', ')} flagged. Compare providers.`,
        variant: 'caution',
      });
    } else {
      insights.push({
        icon: Shield,
        label: 'Insurance',
        value: 'No hazards flagged that typically increase premiums',
        variant: 'good',
      });
    }
  }

  // === CAPITAL GROWTH TRAJECTORY ===
  const trend = report.market?.trend;
  if (trend) {
    const cagr5 = trend.cagr_5yr;
    const cagr1 = trend.cagr_1yr;
    if (cagr5 !== null) {
      if (cagr5 >= 4) {
        insights.push({
          icon: TrendingUp,
          label: 'Rent growth (5yr)',
          value: `Strong — ${cagr5.toFixed(1)}% per year compound growth`,
          variant: 'good',
        });
      } else if (cagr5 >= 2) {
        insights.push({
          icon: TrendingUp,
          label: 'Rent growth (5yr)',
          value: `Moderate — ${cagr5.toFixed(1)}% per year, tracking inflation`,
          variant: 'neutral',
        });
      } else if (cagr5 >= 0) {
        insights.push({
          icon: TrendingUp,
          label: 'Rent growth (5yr)',
          value: `Flat — ${cagr5.toFixed(1)}% per year, below inflation`,
          variant: 'caution',
        });
      } else {
        insights.push({
          icon: TrendingUp,
          label: 'Rent growth (5yr)',
          value: `Declining — ${cagr5.toFixed(1)}% per year`,
          variant: 'warning',
        });
      }
    } else if (cagr1 !== null) {
      insights.push({
        icon: TrendingUp,
        label: 'Rent trend (1yr)',
        value: cagr1 >= 0 ? `Up ${cagr1.toFixed(1)}% this year` : `Down ${Math.abs(cagr1).toFixed(1)}% this year`,
        variant: cagr1 >= 2 ? 'good' : cagr1 >= 0 ? 'neutral' : 'caution',
      });
    }
  }

  if (insights.length === 0) return null;

  const VARIANT_STYLES = {
    good: 'text-piq-success',
    caution: 'text-amber-600 dark:text-amber-400',
    warning: 'text-red-600 dark:text-red-400',
    neutral: 'text-muted-foreground',
  };

  const VARIANT_DOT = {
    good: 'bg-piq-success',
    caution: 'bg-amber-400',
    warning: 'bg-red-500',
    neutral: 'bg-muted-foreground',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-4 w-4 text-piq-primary" />
        <span className="text-sm font-semibold">Buyer Intelligence</span>
      </div>
      <div className="space-y-2.5">
        {insights.map((item) => (
          <div key={item.label} className="flex items-start gap-2.5">
            <span className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${VARIANT_DOT[item.variant]}`} />
            <div>
              <span className="text-xs font-medium">{item.label}</span>
              <p className={`text-xs ${VARIANT_STYLES[item.variant]}`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
