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
      className={`rounded-xl border-2 ${config.border} ${bgClass} p-3 sm:p-4 animate-fade-in-up ${staggerClass}`}
      style={bgStyle}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <Icon className={`h-5 w-5 ${config.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`text-sm font-bold ${config.headlineColor}`}>
              {finding.headline}
            </h4>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${config.labelBg}`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {finding.interpretation}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1.5">
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
  terrain?: import('@/lib/types').PropertyReport['terrain'];
  event_history?: import('@/lib/types').PropertyReport['event_history'];
}, persona?: 'renter' | 'buyer'): Finding[] {
  const findings: Finding[] = [];
  const h = report.hazards;
  const e = report.environment;
  const l = report.liveability;
  const p = report.planning;
  const terrain = report.terrain;
  const eventHist = report.event_history;

  // --- Critical findings (hazards) ---

  if (h.flood_zone) {
    findings.push({
      headline: `This property is in a flood zone (${h.flood_zone})`,
      interpretation:
        'The property may be at risk of flooding during heavy rainfall events. This can affect insurance availability and premiums, and may require specific building modifications.',
      severity: 'critical',
      category: 'Hazards',
      source: 'Regional Council Flood Maps',
    });
  }

  if (h.tsunami_zone) {
    findings.push({
      headline: `Tsunami evacuation zone: ${h.tsunami_zone}`,
      interpretation:
        'This property is within a tsunami evacuation zone. In the event of a large earthquake, you may need to evacuate to higher ground. Know your evacuation route.',
      severity: h.tsunami_zone === '1' || h.tsunami_zone === 'Red' ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'GNS Science / Regional Council',
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
      source: 'Regional Council Liquefaction Maps',
    });
  }

  if (h.slope_failure) {
    const severity = h.slope_failure.toLowerCase();
    if (severity.includes('high')) {
      findings.push({
        headline: `Slope failure risk: ${h.slope_failure}`,
        interpretation:
          'This area is susceptible to landslides during earthquakes. Consider a geotechnical assessment before purchasing, and check retaining wall conditions.',
        severity: severity.includes('very high') ? 'critical' : 'warning',
        category: 'Hazards',
        source: 'Regional Council Slope Failure Maps',
      });
    } else if (severity.includes('moderate') || severity.includes('medium')) {
      findings.push({
        headline: `Slope failure risk: ${h.slope_failure}`,
        interpretation:
          'Moderate slope failure susceptibility in this area. Check retaining walls and drainage, especially on hillside properties.',
        severity: 'info',
        category: 'Hazards',
        source: 'Regional Council Slope Failure Maps',
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

  // Council landslide susceptibility (Auckland etc.)
  if (h.landslide_susceptibility_rating) {
    const rating = h.landslide_susceptibility_rating.toLowerCase();
    if (rating.includes('very high') || rating.includes('high')) {
      findings.push({
        headline: `${rating.includes('very') ? 'Very high' : 'High'} landslide susceptibility zone`,
        interpretation:
          'Council assessment indicates significant landslide risk in this area. This considers both rainfall-triggered and earthquake-induced slope failures. A geotechnical assessment is recommended.',
        severity: rating.includes('very') ? 'critical' : 'warning',
        category: 'Hazards',
        source: 'Council Landslide Susceptibility',
      });
    } else if (rating.includes('moderate') || rating.includes('medium')) {
      findings.push({
        headline: 'Moderate landslide susceptibility',
        interpretation:
          'Some slope instability risk during heavy rain or earthquakes. Check retaining walls and drainage.',
        severity: 'info',
        category: 'Hazards',
        source: 'Council Landslide Susceptibility',
      });
    }
  }

  // Overland flow path
  if (h.on_overland_flow_path || h.overland_flow_within_50m) {
    findings.push({
      headline: 'Near overland flow path',
      interpretation:
        'Surface water may flow through or near this property during heavy rain. Check ground levels, drainage, and whether the building floor is raised above surrounding grade.',
      severity: 'info',
      category: 'Hazards',
      source: 'Council Overland Flow Maps',
    });
  }

  // Aircraft noise
  if (h.aircraft_noise_dba && h.aircraft_noise_dba >= 55) {
    findings.push({
      headline: `Aircraft noise zone: ${h.aircraft_noise_dba} dBA${h.aircraft_noise_name ? ` (${h.aircraft_noise_name})` : ''}`,
      interpretation:
        h.aircraft_noise_dba >= 65
          ? 'High aircraft noise zone. Double glazing and acoustic insulation are strongly recommended. May affect outdoor amenity and sleep quality.'
          : 'Moderate aircraft noise. Check noise levels during peak flight times. Bedrooms facing the flight path may need acoustic glazing.',
      severity: h.aircraft_noise_dba >= 65 ? 'warning' : 'info',
      category: 'Environment',
      source: 'Council Aircraft Noise Overlay',
    });
  }

  // Council coastal erosion
  if (h.council_coastal_erosion && typeof h.council_coastal_erosion === 'object') {
    const dist = h.council_coastal_erosion.distance_m;
    if (dist != null && dist < 200) {
      findings.push({
        headline: `Coastal erosion risk within ${Math.round(dist)}m`,
        interpretation:
          'Council coastal erosion projections show this area could be affected. Review the coastal hazard assessment and check if managed retreat is planned.',
        severity: dist < 50 ? 'critical' : 'warning',
        category: 'Hazards',
        source: 'Council Coastal Erosion Assessment',
      });
    }
  } else if (h.coastal_erosion_exposure) {
    const exp = h.coastal_erosion_exposure.toLowerCase();
    if (exp.includes('high') || exp.includes('very')) {
      findings.push({
        headline: `Coastal erosion exposure: ${h.coastal_erosion_exposure}`,
        interpretation:
          'This location has high coastal erosion exposure. Review council coastal hazard plans and check if managed retreat is being considered.',
        severity: 'warning',
        category: 'Hazards',
        source: 'Council Coastal Erosion Assessment',
      });
    }
  }

  // Coastal inundation / storm surge
  if (h.coastal_inundation_ranking || (h.coastal_elevation_cm != null && h.coastal_elevation_cm < 300)) {
    findings.push({
      headline: h.coastal_elevation_cm != null
        ? `Low coastal elevation: ${(h.coastal_elevation_cm / 100).toFixed(1)}m above MHWS`
        : `Coastal inundation zone${h.coastal_inundation_scenario ? `: ${h.coastal_inundation_scenario}` : ''}`,
      interpretation:
        'This property may be affected by coastal inundation from storm surge and sea-level rise. Saltwater flooding is more damaging than freshwater and can affect insurance availability.',
      severity: (h.coastal_elevation_cm != null && h.coastal_elevation_cm < 200) ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'Council Coastal Hazard Maps',
    });
  }

  // Notable trees (planning constraint)
  if (p.notable_tree_count_50m && p.notable_tree_count_50m > 0) {
    findings.push({
      headline: `${p.notable_tree_count_50m} protected tree${p.notable_tree_count_50m > 1 ? 's' : ''} within 50m`,
      interpretation:
        'Protected/notable trees cannot be removed or significantly pruned without council consent. Check before planning any building work, extensions, or landscaping changes.',
      severity: 'info',
      category: 'Planning',
      source: 'Council Notable Trees Register',
    });
  }

  // Geotechnical reports
  if (h.geotech_count_500m && h.geotech_count_500m >= 10) {
    findings.push({
      headline: `${h.geotech_count_500m} geotechnical reports within 500m`,
      interpretation:
        h.geotech_nearest_hazard
          ? `This area has known ground issues. Nearest report flags: ${h.geotech_nearest_hazard}. Request copies of relevant reports from the council — previous investigations can save you thousands.`
          : 'Multiple geotechnical reports in this area indicate known ground conditions. Request copies from the council before commissioning your own assessment.',
      severity: 'info',
      category: 'Hazards',
      source: 'Council Geotechnical Reports',
    });
  }

  if (h.epb_count && h.epb_count > 0) {
    findings.push({
      headline: `${h.epb_count} earthquake-prone building${h.epb_count > 1 ? 's' : ''} within 300m`,
      interpretation:
        'Nearby earthquake-prone buildings may pose a risk during a significant earthquake. These buildings may require seismic strengthening or demolition.',
      severity: h.epb_count >= 3 ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'MBIE EPB Register',
    });
  }

  const contaminationCount = p.contamination_count ?? h.contamination_count ?? 0;
  if (contaminationCount > 0) {
    findings.push({
      headline: `${contaminationCount} HAIL site${contaminationCount > 1 ? 's' : ''} within 500m`,
      interpretation:
        'HAIL = Hazardous Activities and Industries List (Ministry for the Environment). These are sites with a history of activities that may have contaminated the land — not necessarily this property, but nearby. Check the council\'s SLUR for details before digging or growing food.',
      severity: contaminationCount >= 5 ? 'warning' : 'info',
      category: 'Planning',
      source: 'Regional Council SLUR / HAIL',
    });
  }

  // --- Council-specific hazard findings ---

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
      source: 'Regional Council Earthquake Hazard',
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
        source: 'Regional Council Ground Shaking Map',
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
      source: 'Regional Council Liquefaction Map',
    });
  }

  if (h.fault_zone_name) {
    findings.push({
      headline: `Near fault zone: ${h.fault_zone_name}`,
      interpretation:
        h.fault_zone_ranking
          ? `Hazard ranking: ${h.fault_zone_ranking}. Properties near active fault traces face higher risk of surface rupture and ground deformation during earthquakes.`
          : 'Located near a mapped fault trace. District Plans typically have specific building restrictions in fault avoidance zones.',
      severity: h.fault_zone_ranking?.toLowerCase().includes('high') ? 'critical' : 'warning',
      category: 'Hazards',
      source: 'District Plan / GNS Active Faults',
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
      source: 'District Plan Tsunami Zones',
    });
  }

  if (h.solar_mean_kwh && h.solar_mean_kwh > 0) {
    const solarGood = h.solar_mean_kwh >= 1200;
    findings.push({
      headline: `Solar potential: ${Math.round(h.solar_mean_kwh)} kWh/m²/year`,
      interpretation: solarGood
        ? 'Good solar exposure. This building receives above-average sunshine, making solar panels a viable investment and improving winter liveability.'
        : 'Below-average solar exposure. This may mean less natural light and warmth in winter — check north-facing windows and heating costs.',
      severity: solarGood ? 'positive' : 'info',
      category: 'Liveability',
      source: 'Council Building Solar Radiation',
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
      source: 'Regional Council, GNS Science',
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

  // --- Planning findings ---

  if (p.in_heritage_overlay && p.heritage_overlay_name) {
    findings.push({
      headline: `Heritage overlay: ${p.heritage_overlay_name}`,
      interpretation:
        'External modifications may require resource consent. Check the heritage schedule for specific controls on this site.',
      severity: 'info',
      category: 'Planning',
      source: 'Council Heritage Overlay',
    });
  }

  if (p.in_special_character_area && p.special_character_name) {
    findings.push({
      headline: `Special character area: ${p.special_character_name}`,
      interpretation:
        'Demolition and major alterations are controlled. New builds and additions must be sympathetic to neighbourhood character.',
      severity: 'info',
      category: 'Planning',
      source: 'Council District/Unitary Plan',
    });
  }

  if (p.in_ecological_area) {
    findings.push({
      headline: `Significant ecological area${p.ecological_area_name ? `: ${p.ecological_area_name}` : ''}`,
      interpretation:
        'Vegetation removal, earthworks, and building may require ecological assessment and resource consent.',
      severity: 'info',
      category: 'Planning',
      source: 'Council District/Unitary Plan',
    });
  }

  if (p.notable_tree_count_50m && p.notable_tree_count_50m > 0) {
    findings.push({
      headline: `${p.notable_tree_count_50m} protected tree${p.notable_tree_count_50m > 1 ? 's' : ''} within 50m`,
      interpretation:
        'Scheduled/notable trees are protected. Removal or significant pruning requires resource consent. Root protection zones may restrict building.',
      severity: 'info',
      category: 'Planning',
      source: 'Council Notable Trees Register',
    });
  }

  if (p.park_count_500m && p.park_count_500m >= 3 && p.nearest_park_distance_m && p.nearest_park_distance_m <= 300) {
    findings.push({
      headline: `${p.park_count_500m} parks within 500m${p.nearest_park_name ? ` — nearest: ${p.nearest_park_name}` : ''}`,
      interpretation:
        'Excellent green space access. Multiple parks nearby is a strong positive for families, exercise, and property values.',
      severity: 'positive',
      category: 'Liveability',
      source: 'Council Parks Data',
    });
  }

  // --- Terrain-inferred findings ---
  if (terrain?.is_depression && !h.flood_zone) {
    const depth = terrain.depression_depth_m;
    findings.push({
      headline: `Natural low point${depth ? ` (${Math.abs(depth).toFixed(1)}m below surroundings)` : ''} — water may collect here`,
      interpretation:
        'This property sits lower than its immediate surroundings, creating a natural collection point for rainwater. Check for signs of past ponding and ensure stormwater drainage is adequate.',
      severity: terrain.flood_terrain_risk === 'high' ? 'warning' : 'info',
      category: 'Hazards',
      source: 'Terrain Analysis (SRTM 30m)',
    });
  }

  if (terrain?.flood_terrain_risk === 'moderate' && !terrain?.is_depression && !h.flood_zone) {
    findings.push({
      headline: 'Flat, low-lying terrain — limited natural drainage',
      interpretation:
        'No council flood zone is mapped here, but flat low-lying ground is inherently vulnerable to surface flooding during heavy rain. Check floor levels and stormwater capacity.',
      severity: 'info',
      category: 'Hazards',
      source: 'Terrain Analysis (SRTM 30m)',
    });
  }

  if (terrain?.wind_exposure === 'very_exposed') {
    findings.push({
      headline: `Exposed ${terrain.relative_position === 'hilltop' ? 'hilltop' : 'ridgeline'} — expect strong winds`,
      interpretation:
        'This elevated, exposed position faces significantly stronger winds, especially from the prevailing westerly direction. Check roof fixings and cladding meet wind zone requirements.',
      severity: 'warning',
      category: 'Hazards',
      source: 'Terrain Analysis (SRTM 30m)',
    });
  } else if (terrain?.wind_exposure === 'sheltered' && terrain?.relative_position && ['depression', 'valley'].includes(terrain.relative_position)) {
    findings.push({
      headline: 'Naturally sheltered from wind',
      interpretation:
        'The surrounding terrain provides natural wind protection. This reduces exterior wear and improves outdoor comfort.',
      severity: 'positive',
      category: 'Liveability',
      source: 'Terrain Analysis (SRTM 30m)',
    });
  }

  // --- Waterway proximity findings ---
  if (terrain?.nearest_waterway_m != null && terrain.nearest_waterway_m <= 50) {
    const wName = terrain.nearest_waterway_name;
    const wType = terrain.nearest_waterway_type === 'river_cl' ? 'river' : 'stream';
    findings.push({
      headline: `${wType.charAt(0).toUpperCase() + wType.slice(1)}${wName ? ` (${wName})` : ''} just ${terrain.nearest_waterway_m}m away`,
      interpretation:
        'Very close proximity to a waterway significantly increases flood risk during heavy or prolonged rainfall. Check floor levels and insurance coverage.',
      severity: 'warning',
      category: 'Hazards',
      source: 'LINZ Topo50 Waterways',
    });
  } else if (terrain?.nearest_waterway_m != null && terrain.nearest_waterway_m <= 100) {
    const wType = terrain.nearest_waterway_type === 'river_cl' ? 'River' : 'Waterway';
    findings.push({
      headline: `${wType} within ${terrain.nearest_waterway_m}m`,
      interpretation:
        'Proximity to waterways increases flood exposure during heavy rainfall. Check council flood maps for this area.',
      severity: 'info',
      category: 'Hazards',
      source: 'LINZ Topo50 Waterways',
    });
  }

  // --- Event history findings ---
  if (eventHist) {
    if (eventHist.extreme_weather_5yr >= 5) {
      findings.push({
        headline: `${eventHist.extreme_weather_5yr} extreme weather events recorded nearby in 5 years`,
        interpretation:
          'Frequent severe weather increases risk of flooding, slips, and property damage. Check insurance covers weather-related damage.',
        severity: 'warning',
        category: 'Hazards',
        source: 'Open-Meteo Weather Archive',
      });
    } else if (eventHist.extreme_weather_5yr >= 2) {
      findings.push({
        headline: `${eventHist.extreme_weather_5yr} extreme weather events recorded nearby in 5 years`,
        interpretation:
          'Review property for weather resilience — drainage, roof condition, and tree proximity.',
        severity: 'info',
        category: 'Hazards',
        source: 'Open-Meteo Weather Archive',
      });
    }

    if (eventHist.earthquakes_30km_10yr >= 5) {
      const magStr = eventHist.largest_quake_magnitude ? `, largest M${eventHist.largest_quake_magnitude.toFixed(1)}` : '';
      findings.push({
        headline: `${eventHist.earthquakes_30km_10yr} earthquakes M4+ within 30km in 10 years${magStr}`,
        interpretation:
          'Seismically active area. Check the building\'s earthquake resilience and review EQC claim history.',
        severity: eventHist.earthquakes_30km_10yr >= 10 ? 'warning' : 'info',
        category: 'Hazards',
        source: 'GeoNet Earthquake Database',
      });
    }
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
