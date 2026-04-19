'use client';

import type { PropertyReport } from '@/lib/types';
import type { QuestionId } from '@/lib/reportSections';
import { formatCompactCurrency, effectivePerUnitCv } from '@/lib/format';
import { isInFloodZone } from '@/lib/hazards';

export interface PreviewChip {
  label: string;
  variant: 'green' | 'amber' | 'red' | 'blue' | 'neutral';
}

/**
 * Returns small data-point badges to show in the collapsed accordion trigger.
 * These tease the content inside to incentivise expanding.
 */
export function getPreviewChips(questionId: QuestionId, report: PropertyReport): PreviewChip[] {
  const h = report.hazards;
  const l = report.liveability;
  const m = report.market;
  const p = report.planning;
  const e = report.environment;
  const chips: PreviewChip[] = [];

  switch (questionId) {
    case 'safety':
    case 'deal-breakers': {
      const riskCat = report.scores?.categories?.find(c => c.name === 'risk');
      const highCount = riskCat?.indicators.filter(i => i.is_available && i.score >= 60).length ?? 0;
      const okCount = riskCat?.indicators.filter(i => i.is_available && i.score < 40).length ?? 0;
      if (highCount > 0) chips.push({ label: `${highCount} risk${highCount > 1 ? 's' : ''} found`, variant: 'red' });
      if (okCount > 0) chips.push({ label: `${okCount} clear`, variant: 'green' });
      if (l.crime_rate != null) {
        chips.push({
          label: l.crime_rate <= 30 ? 'Low crime' : l.crime_rate <= 60 ? 'Moderate crime' : 'High crime',
          variant: l.crime_rate <= 30 ? 'green' : l.crime_rate <= 60 ? 'amber' : 'red',
        });
      }
      break;
    }

    case 'rent-fair': {
      if (m.rent_assessment) {
        chips.push({ label: `$${m.rent_assessment.median}/wk median`, variant: 'blue' });
        if (m.rent_assessment.bond_count >= 20) {
          chips.push({ label: `${m.rent_assessment.bond_count} bonds`, variant: 'neutral' });
        }
      }
      if (m.trend?.cagr_1yr != null) {
        chips.push({
          label: `${m.trend.cagr_1yr > 0 ? '+' : ''}${m.trend.cagr_1yr.toFixed(1)}%/yr`,
          variant: m.trend.cagr_1yr > 3 ? 'red' : m.trend.cagr_1yr < 0 ? 'green' : 'amber',
        });
      }
      if (m.market_heat && m.market_heat !== 'neutral') {
        const heatLabel: Record<string, string> = { cold: 'Cold market', cool: 'Cool market', warm: 'Warm market', hot: 'Hot market' };
        chips.push({
          label: heatLabel[m.market_heat] ?? m.market_heat,
          variant: m.market_heat === 'hot' || m.market_heat === 'warm' ? 'red' : 'blue',
        });
      }
      break;
    }

    case 'daily-life': {
      if (l.transit_count != null) {
        chips.push({ label: `${l.transit_count} stops (400m)`, variant: l.transit_count >= 5 ? 'green' : 'amber' });
      }
      if (e.noise_db != null) {
        chips.push({
          label: `${Math.round(e.noise_db)}dB`,
          variant: e.noise_db <= 55 ? 'green' : e.noise_db <= 65 ? 'amber' : 'red',
        });
      }
      if (l.school_count != null && l.school_count > 0) {
        chips.push({ label: `${l.school_count} school${l.school_count > 1 ? 's' : ''}`, variant: 'neutral' });
      }
      break;
    }

    case 'neighbourhood': {
      // Snapshot of area today: deprivation + crime + schools/amenities, no trend.
      if (l.nzdep_score != null) {
        chips.push({
          label: `NZDep ${l.nzdep_score}`,
          variant: l.nzdep_score <= 3 ? 'green' : l.nzdep_score <= 7 ? 'amber' : 'red',
        });
      }
      if (l.crime_rate != null) {
        chips.push({
          label: l.crime_rate <= 50 ? 'Lower crime' : 'Higher crime',
          variant: l.crime_rate <= 50 ? 'green' : 'red',
        });
      }
      if (l.school_count != null && l.school_count > 0) {
        chips.push({ label: `${l.school_count} school${l.school_count > 1 ? 's' : ''}`, variant: 'neutral' });
      }
      break;
    }

    case 'true-cost': {
      const perUnit = effectivePerUnitCv(report.property.capital_value, {
        isMultiUnit: !!report.property_detection?.is_multi_unit,
        unitCount: report.property_detection?.unit_count,
      });
      if (perUnit) {
        chips.push({ label: `Valuation ${formatCompactCurrency(perUnit)}`, variant: 'blue' });
      }
      if (m.rent_assessment?.median && perUnit) {
        const grossYield = (m.rent_assessment.median * 52 / perUnit) * 100;
        if (grossYield >= 0.5 && grossYield <= 20) {
          chips.push({ label: `${grossYield.toFixed(1)}% yield`, variant: grossYield >= 5 ? 'green' : 'amber' });
        }
      }
      break;
    }

    case 'investment': {
      if (m.market_heat && m.market_heat !== 'neutral') {
        chips.push({
          label: `Market ${m.market_heat}`,
          variant: m.market_heat === 'hot' ? 'red' : m.market_heat === 'warm' ? 'amber' : 'blue',
        });
      }
      if (m.trend?.cagr_1yr != null) {
        chips.push({
          label: `1yr ${m.trend.cagr_1yr > 0 ? '+' : ''}${m.trend.cagr_1yr.toFixed(1)}%`,
          variant: m.trend.cagr_1yr > 0 ? 'green' : 'red',
        });
      }
      break;
    }

    case 'restrictions': {
      if (p.zone_name) chips.push({ label: p.zone_name, variant: 'neutral' });
      if (p.height_limit) chips.push({ label: `${p.height_limit}m limit`, variant: 'blue' });
      if (p.heritage_count && p.heritage_count > 0) chips.push({ label: 'Heritage', variant: 'amber' });
      break;
    }

    case 'renter-checklist':
    case 'buyer-checklist': {
      const riskCat = report.scores?.categories?.find(c => c.name === 'risk');
      const critCount = riskCat?.indicators.filter(i => i.is_available && i.score >= 70).length ?? 0;
      if (critCount > 0) chips.push({ label: `${critCount} critical`, variant: 'red' });
      else chips.push({ label: 'Standard checks', variant: 'green' });
      break;
    }
  }

  return chips.slice(0, 4); // max 4 chips
}

/**
 * Computes a one-line natural language answer for each question from report data.
 * Used as the teaser text in accordion triggers.
 */
export function getQuestionSummary(questionId: QuestionId, report: PropertyReport): string {
  const h = report.hazards;
  const l = report.liveability;
  const m = report.market;
  const p = report.planning;
  const e = report.environment;

  switch (questionId) {
    case 'safety':
    case 'deal-breakers': {
      const issues: string[] = [];
      if (p.epb_listed) issues.push('EPB listed');
      if (isInFloodZone(h)) issues.push('flood zone');
      if (h.tsunami_zone) issues.push('tsunami zone');
      if (h.liquefaction_zone?.toLowerCase().includes('high') || h.liquefaction_zone?.toLowerCase().includes('moderate'))
        issues.push('liquefaction risk');
      if (h.slope_failure?.toLowerCase().includes('high')) issues.push('slope risk');
      if (h.contamination_count && h.contamination_count >= 3) issues.push('nearby contamination');
      if (h.landslide_in_area) issues.push('mapped landslide area');
      if (h.earthquake_hazard_grade != null && h.earthquake_hazard_grade >= 3) issues.push('seismic hazard');
      if (h.epb_count && h.epb_count >= 10) issues.push(`${h.epb_count} EPBs within 300m`);
      if (l.crime_rate != null && l.crime_rate >= 70) issues.push('high crime area');
      if (e.wind_zone === 'EH' || e.wind_zone === 'SED') issues.push('extreme wind zone');
      if (h.coastal_erosion) issues.push('coastal erosion risk');
      // Check score categories for high-risk indicators
      const riskCat = report.scores?.categories?.find(c => c.name === 'risk');
      const highScoreCount = riskCat?.indicators.filter(i => i.is_available && i.score >= 70).length ?? 0;
      if (issues.length === 0 && highScoreCount > 0) {
        return `${highScoreCount} elevated risk indicator${highScoreCount > 1 ? 's' : ''} detected.`;
      }

      if (issues.length === 0) {
        return 'No major hazards detected.';
      }
      return `${issues.length} concern${issues.length > 1 ? 's' : ''}: ${issues.join(', ')}.`;
    }

    case 'rent-fair': {
      if (!m.rent_assessment) return 'No rental data available for this area.';
      const median = m.rent_assessment.median;
      const trend = m.trend?.cagr_1yr;
      const trendText = trend != null
        ? trend > 0
          ? `, trending up ${trend.toFixed(1)}%/yr`
          : trend < 0
            ? `, trending down ${Math.abs(trend).toFixed(1)}%/yr`
            : ', stable'
        : '';
      return `Median rent: $${median}/wk in this area${trendText}.`;
    }

    case 'daily-life': {
      const parts: string[] = [];
      if (l.transit_count != null) parts.push(`${l.transit_count} transit stops nearby`);
      if (l.school_count != null) parts.push(`${l.school_count} schools`);
      if (e.noise_db != null) parts.push(`${Math.round(e.noise_db)}dB road noise`);
      return parts.length > 0 ? parts.join(' · ') + '.' : 'Limited liveability data available.';
    }

    case 'neighbourhood': {
      // Answers "what's the area like right now?" — snapshot of deprivation, crime, schools.
      const parts: string[] = [];
      if (l.nzdep_score != null) parts.push(`NZDep ${l.nzdep_score}/10`);
      if (l.crime_rate != null) {
        parts.push(l.crime_rate <= 50 ? 'below-average crime' : 'above-average crime');
      }
      if (l.school_count != null) parts.push(`${l.school_count} schools nearby`);
      return parts.length > 0 ? parts.join(' · ') + '.' : 'Limited neighbourhood data.';
    }

    case 'true-cost': {
      const parts: string[] = [];
      const perUnit = effectivePerUnitCv(report.property.capital_value, {
        isMultiUnit: !!report.property_detection?.is_multi_unit,
        unitCount: report.property_detection?.unit_count,
      });
      if (perUnit) {
        parts.push(`Valuation ${formatCompactCurrency(perUnit)}`);
      }
      if (m.rent_assessment?.median && perUnit) {
        const annualRent = m.rent_assessment.median * 52;
        const grossYield = (annualRent / perUnit) * 100;
        if (grossYield >= 0.5 && grossYield <= 20) {
          parts.push(`est. yield ${grossYield.toFixed(1)}%`);
        }
      }
      return parts.length > 0 ? parts.join(' · ') + '.' : 'Limited cost data available.';
    }

    case 'investment': {
      const parts: string[] = [];
      if (m.market_heat && m.market_heat !== 'neutral') {
        parts.push(`market ${m.market_heat}`);
      }
      if (m.trend?.cagr_5yr != null) {
        parts.push(`5yr rent CAGR ${m.trend.cagr_5yr > 0 ? '+' : ''}${m.trend.cagr_5yr.toFixed(1)}%`);
      }
      if (m.trend?.cagr_1yr != null) {
        parts.push(`1yr ${m.trend.cagr_1yr > 0 ? '+' : ''}${m.trend.cagr_1yr.toFixed(1)}%`);
      }
      return parts.length > 0 ? parts.join(' · ') + '.' : 'Limited market data.';
    }

    case 'restrictions': {
      const parts: string[] = [];
      if (p.zone_name) parts.push(p.zone_name);
      if (p.height_limit) parts.push(`${p.height_limit}m height limit`);
      if (p.heritage_count && p.heritage_count > 0) parts.push(`${p.heritage_count} heritage items`);
      return parts.length > 0 ? parts.join(' · ') + '.' : 'No significant restrictions found.';
    }

    case 'renter-checklist':
      return 'Insulation, healthy homes, contents insurance, commute check.';

    case 'buyer-checklist': {
      const critical: string[] = [];
      if (isInFloodZone(h)) critical.push('flood assessment');
      if (p.epb_listed) critical.push('seismic assessment');
      if (h.slope_failure?.toLowerCase().includes('high')) critical.push('geotech report');
      const prefix = critical.length > 0
        ? `${critical.length} critical: ${critical.join(', ')}. `
        : '';
      return `${prefix}Plus building inspection, LIM report, title review.`;
    }

    default:
      return '';
  }
}
