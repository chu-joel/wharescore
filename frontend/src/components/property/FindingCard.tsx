'use client';

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { RatingBin } from '@/lib/types';

export interface Finding {
  headline: string;
  interpretation: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  category: string;
  source: string;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    border: 'border-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    iconColor: 'text-red-600',
    headlineColor: 'text-red-800 dark:text-red-300',
    label: 'Critical',
    labelBg: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    iconColor: 'text-amber-600',
    headlineColor: 'text-amber-800 dark:text-amber-300',
    label: 'Watch',
    labelBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  },
  info: {
    icon: Info,
    border: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-600',
    headlineColor: 'text-blue-800 dark:text-blue-300',
    label: 'Note',
    labelBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  positive: {
    icon: CheckCircle2,
    border: 'border-green-500',
    bg: 'bg-green-50 dark:bg-green-950/30',
    iconColor: 'text-green-600',
    headlineColor: 'text-green-800 dark:text-green-300',
    label: 'Good',
    labelBg: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  },
} as const;

export function FindingCard({ finding, index }: { finding: Finding; index?: number }) {
  const config = SEVERITY_CONFIG[finding.severity];
  const Icon = config.icon;

  const bgStyle = finding.severity === 'critical'
    ? { background: 'linear-gradient(90deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.02) 30%, transparent 100%)' }
    : undefined;

  const staggerClass = `stagger-${Math.min((index ?? 0) + 1, 5)}`;
  const bgClass = finding.severity === 'critical' ? 'dark:bg-red-950/30' : config.bg;

  return (
    <div
      className={`rounded-xl border-2 ${config.border} ${bgClass} p-4 animate-fade-in-up ${staggerClass}`}
      style={bgStyle}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 ${config.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`text-sm font-bold ${config.headlineColor}`}>
              {finding.headline}
            </h4>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.labelBg}`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {finding.interpretation}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">
            Source: {finding.source}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate findings from the property report data.
 * Each finding has a plain English headline + interpretation.
 * Optionally accepts a persona to reorder findings by relevance.
 */
export function generateFindings(report: {
  hazards: import('@/lib/types').HazardData;
  environment: import('@/lib/types').EnvironmentData;
  liveability: import('@/lib/types').LiveabilityData;
  planning: import('@/lib/types').PlanningData;
  scores: import('@/lib/types').CompositeScore;
}, persona?: 'renter' | 'buyer'): Finding[] {
  const findings: Finding[] = [];
  const h = report.hazards;
  const e = report.environment;
  const l = report.liveability;
  const p = report.planning;

  // --- Critical findings (hazards) ---

  if (h.flood_zone) {
    findings.push({
      headline: `This property is in a flood zone (${h.flood_zone})`,
      interpretation:
        'The property may be at risk of flooding during heavy rainfall events. This can affect insurance availability and premiums, and may require specific building modifications.',
      severity: 'critical',
      category: 'Hazards',
      source: 'GWRC Flood Hazard Maps',
    });
  }

  if (h.tsunami_zone) {
    findings.push({
      headline: `Tsunami evacuation zone: ${h.tsunami_zone}`,
      interpretation:
        'This property is within a tsunami evacuation zone. In the event of a large earthquake, you may need to evacuate to higher ground. Know your evacuation route.',
      severity: h.tsunami_zone === '1' || h.tsunami_zone === 'Red' ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'GNS Science / GWRC',
    });
  }

  if (h.liquefaction_zone) {
    const isHigh = h.liquefaction_zone.toLowerCase().includes('high') || h.liquefaction_zone.toLowerCase().includes('very');
    findings.push({
      headline: `Liquefaction susceptibility: ${h.liquefaction_zone}`,
      interpretation:
        'The ground here could become unstable during a major earthquake, similar to what happened in Christchurch. This affects foundation requirements and insurance.',
      severity: isHigh ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'GWRC',
    });
  }

  if (h.slope_failure) {
    const severity = h.slope_failure.toLowerCase();
    if (severity.includes('high') || severity.includes('very')) {
      findings.push({
        headline: `Slope failure risk: ${h.slope_failure}`,
        interpretation:
          'This area is susceptible to landslides during earthquakes. Consider a geotechnical assessment before purchasing, and check retaining wall conditions.',
        severity: severity.includes('very') ? 'critical' : 'warning',
        category: 'Hazards',
        source: 'GWRC Slope Failure Maps',
      });
    }
  }

  if (h.landslide_count_500m && h.landslide_count_500m > 0) {
    const nearest = h.landslide_nearest;
    const triggerText = nearest?.trigger === 'Rainfall' ? 'rainfall-triggered' : nearest?.trigger === 'Earthquake' ? 'earthquake-triggered' : 'documented';
    findings.push({
      headline: `${h.landslide_count_500m} ${triggerText} landslide${h.landslide_count_500m > 1 ? 's' : ''} recorded within 500m`,
      interpretation:
        h.landslide_count_500m >= 3
          ? 'Multiple historical landslides in this area indicate significant slope instability. Commission a geotechnical assessment and check retaining walls before purchasing.'
          : 'Historical landslide activity has been recorded nearby. Check the property for signs of ground movement, retaining wall condition, and drainage adequacy.',
      severity: h.landslide_count_500m >= 3 ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'GNS NZ Landslide Database',
    });
  }

  if (h.landslide_in_area) {
    findings.push({
      headline: 'Property is within a mapped landslide area',
      interpretation:
        'This property sits within the boundary of a mapped historical landslide. This is a significant risk factor — a geotechnical report is essential before any purchase decision.',
      severity: 'critical',
      category: 'Hazards',
      source: 'GNS NZ Landslide Database',
    });
  }

  if (h.coastal_erosion) {
    const isHigh = h.coastal_erosion.toLowerCase().includes('high') || h.coastal_erosion.toLowerCase().includes('severe');
    if (isHigh) {
      findings.push({
        headline: `Coastal erosion risk: ${h.coastal_erosion}`,
        interpretation:
          'This coastal location faces erosion risk that could affect the property over time. Check council records for any managed retreat plans.',
        severity: 'warning',
        category: 'Hazards',
        source: 'NIWA Coastal Sensitivity Index',
      });
    }
  }

  if (h.epb_count && h.epb_count > 0) {
    findings.push({
      headline: `${h.epb_count} earthquake-prone building${h.epb_count > 1 ? 's' : ''} within 300m`,
      interpretation:
        'Nearby earthquake-prone buildings may pose a risk during a significant earthquake. These buildings may require seismic strengthening or demolition.',
      severity: h.epb_count >= 3 ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'WCC / MBIE EPB Register',
    });
  }

  if (h.contamination_count && h.contamination_count > 0) {
    findings.push({
      headline: `${h.contamination_count} contaminated site${h.contamination_count > 1 ? 's' : ''} nearby`,
      interpretation:
        'There are sites with known or suspected contamination in the vicinity. Check the Selected Land Use Register (SLUR) for details and any restrictions.',
      severity: h.contamination_count >= 5 ? 'warning' : 'info',
      category: 'Planning',
      source: 'GWRC SLUR',
    });
  }

  // --- Wellington-specific hazard findings ---

  if (h.epb_rating) {
    findings.push({
      headline: `This building is earthquake-prone (${h.epb_rating})`,
      interpretation:
        h.epb_construction_type
          ? `${h.epb_construction_type} construction. ${h.epb_deadline ? `Seismic strengthening required by ${h.epb_deadline}.` : 'Check the MBIE register for the compliance deadline.'} This affects insurance, lending, and resale value.`
          : 'The building is on the national earthquake-prone building register. This affects insurance, mortgage availability, and resale value.',
      severity: 'critical',
      category: 'Hazards',
      source: 'MBIE Earthquake-Prone Building Register',
    });
  }

  if (h.earthquake_hazard_grade && h.earthquake_hazard_grade >= 4) {
    findings.push({
      headline: `High combined earthquake hazard (grade ${h.earthquake_hazard_grade}/5)`,
      interpretation:
        'This location has elevated seismic risk from the combination of ground shaking, liquefaction, and slope failure. Multiple hazards compound the risk.',
      severity: h.earthquake_hazard_grade >= 5 ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'GWRC Combined Earthquake Hazard',
    });
  }

  if (h.ground_shaking_severity) {
    const gsHigh = h.ground_shaking_severity.toLowerCase().includes('high');
    if (gsHigh) {
      findings.push({
        headline: `Ground shaking amplification: ${h.ground_shaking_severity}`,
        interpretation:
          h.gwrc_liquefaction_geology
            ? `Built on ${h.gwrc_liquefaction_geology.toLowerCase()} — earthquake shaking is amplified here compared to bedrock areas. This is especially important for older buildings.`
            : 'This area amplifies earthquake shaking due to the underlying soil conditions. Newer buildings with modern foundations handle this better.',
        severity: 'warning',
        category: 'Hazards',
        source: 'GWRC Ground Shaking Map',
      });
    }
  }

  if (h.gwrc_liquefaction_geology?.toLowerCase().includes('reclaimed')) {
    findings.push({
      headline: 'Built on reclaimed land',
      interpretation:
        'Reclaimed land is particularly susceptible to liquefaction during earthquakes. The Christchurch earthquakes showed devastating effects on reclaimed/fill areas. Foundation type is critical.',
      severity: 'critical',
      category: 'Hazards',
      source: 'GWRC Liquefaction Map',
    });
  }

  if (h.fault_zone_name) {
    findings.push({
      headline: `Near fault zone: ${h.fault_zone_name}`,
      interpretation:
        h.fault_zone_ranking
          ? `Hazard ranking: ${h.fault_zone_ranking}. The Wellington Fault runs through the city — properties near fault traces face higher risk of surface rupture and ground deformation.`
          : 'Located near a mapped fault trace. The WCC District Plan has specific building restrictions in fault avoidance zones.',
      severity: h.fault_zone_ranking?.toLowerCase().includes('high') ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'WCC 2024 District Plan',
    });
  }

  if (h.wcc_tsunami_return_period && h.wcc_tsunami_return_period !== '1:1000yr') {
    findings.push({
      headline: `District Plan tsunami zone (${h.wcc_tsunami_return_period})`,
      interpretation:
        h.wcc_tsunami_return_period === '1:100yr'
          ? 'In the highest-risk tsunami zone (1-in-100-year event). This is a frequent enough return period to factor into insurance and building design decisions.'
          : 'In a moderate tsunami risk zone. While less frequent, a 1-in-500-year tsunami could cause significant damage at this location.',
      severity: h.wcc_tsunami_return_period === '1:100yr' ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'WCC 2024 District Plan',
    });
  }

  if (h.solar_mean_kwh && h.solar_mean_kwh > 0) {
    const solarGood = h.solar_mean_kwh >= 1200;
    findings.push({
      headline: `Solar potential: ${Math.round(h.solar_mean_kwh)} kWh/m²/year`,
      interpretation: solarGood
        ? 'Good solar exposure. This building receives above-average sunshine for Wellington, making solar panels a viable investment and improving winter liveability.'
        : 'Below-average solar exposure for Wellington. This may mean less natural light and warmth in winter — check north-facing windows and heating costs.',
      severity: solarGood ? 'positive' : 'info',
      category: 'Liveability',
      source: 'WCC Building Solar Radiation',
    });
  }

  // --- Environment findings ---

  if (e.noise_db && e.noise_db >= 60) {
    findings.push({
      headline: `Road noise level: ${e.noise_db} dB`,
      interpretation:
        e.noise_db >= 65
          ? 'This is a high-noise area comparable to a busy restaurant. Consider acoustic glazing and ventilation that doesn\'t require opening windows.'
          : 'Moderate road noise. Double glazing should mitigate most of the impact for indoor living.',
      severity: e.noise_db >= 65 ? 'warning' : 'info',
      category: 'Environment',
      source: 'Waka Kotahi NZTA',
    });
  }

  // --- Positive findings ---

  if (!h.flood_zone && !h.tsunami_zone && !h.liquefaction_zone) {
    findings.push({
      headline: 'No major natural hazards detected',
      interpretation:
        'This property is not in a flood zone, tsunami evacuation zone, or liquefaction-prone area. This is a positive indicator for insurance and long-term resilience.',
      severity: 'positive',
      category: 'Hazards',
      source: 'GWRC, GNS Science',
    });
  }

  if (l.school_count && l.school_count >= 5) {
    findings.push({
      headline: `${l.school_count} schools within 1.5km`,
      interpretation:
        'Good access to education options in the area. Multiple schools nearby gives families choice and reduces commute times for school runs.',
      severity: 'positive',
      category: 'Liveability',
      source: 'Ministry of Education',
    });
  }

  if (l.transit_count && l.transit_count >= 5) {
    findings.push({
      headline: `${l.transit_count} transit stops within 400m`,
      interpretation:
        'Excellent public transport access. Multiple bus stops nearby means good frequency and route options for commuting.',
      severity: 'positive',
      category: 'Liveability',
      source: 'Metlink GTFS',
    });
  }

  if (l.nzdep_score && l.nzdep_score <= 3) {
    findings.push({
      headline: `Low deprivation area (NZDep ${l.nzdep_score}/10)`,
      interpretation:
        'This neighbourhood ranks in the least deprived 30% of New Zealand. This typically correlates with better access to services, lower crime, and higher property values.',
      severity: 'positive',
      category: 'Liveability',
      source: 'University of Otago / Stats NZ',
    });
  }

  if (l.nzdep_score && l.nzdep_score >= 8) {
    findings.push({
      headline: `High deprivation area (NZDep ${l.nzdep_score}/10)`,
      interpretation:
        'This neighbourhood is in the most deprived 30% of New Zealand. This may correlate with higher crime rates and fewer local services, but also often means more affordable property prices.',
      severity: 'info',
      category: 'Liveability',
      source: 'University of Otago / Stats NZ',
    });
  }

  // Sort: critical first, then warning, then info, then positive
  const severityOrder = { critical: 0, warning: 1, info: 2, positive: 3 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Persona-aware reordering: boost relevant categories to the top within same severity
  if (persona) {
    const renterCategories = ['Hazards', 'Liveability', 'Environment'];
    const buyerCategories = ['Hazards', 'Planning', 'Liveability'];
    const priorityCategories = persona === 'renter' ? renterCategories : buyerCategories;

    findings.sort((a, b) => {
      // First by severity
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      // Then by persona category relevance
      const aIdx = priorityCategories.indexOf(a.category);
      const bIdx = priorityCategories.indexOf(b.category);
      const aRank = aIdx >= 0 ? aIdx : 99;
      const bRank = bIdx >= 0 ? bIdx : 99;
      return aRank - bRank;
    });
  }

  return findings;
}
