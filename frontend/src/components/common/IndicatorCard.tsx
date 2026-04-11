'use client';

import { Badge } from '@/components/ui/badge';
import { Shield, CircleMinus, AlertTriangle } from 'lucide-react';
import type { IndicatorScore } from '@/lib/types';

interface IndicatorCardProps {
  indicator: IndicatorScore;
}

function badgeVariant(rating: string) {
  if (rating === 'very-low' || rating === 'low') return 'default' as const;
  if (rating === 'moderate') return 'secondary' as const;
  return 'destructive' as const;
}

function ratingLabel(rating: string): string {
  // The score runs 0 (safest) → 100 (highest risk). These labels make
  // that direction explicit on the badge so users don't have to infer.
  switch (rating) {
    case 'very-low':
      return 'Low risk';
    case 'low':
      return 'Low risk';
    case 'moderate':
      return 'Moderate';
    case 'high':
      return 'High risk';
    case 'very-high':
      return 'High risk';
    default:
      return rating;
  }
}

function RiskIcon({ rating }: { rating: string }) {
  if (rating === 'very-low' || rating === 'low') {
    return <Shield className="w-3.5 h-3.5 text-risk-very-low shrink-0" />;
  }
  if (rating === 'moderate') {
    return <CircleMinus className="w-3.5 h-3.5 text-risk-moderate shrink-0" />;
  }
  return <AlertTriangle className="w-3.5 h-3.5 text-risk-very-high shrink-0" />;
}

/** Human-readable description for each indicator based on score level */
function getIndicatorDescription(name: string, score: number, rating: string): string | null {
  const n = name.toLowerCase();
  const isGood = rating === 'very-low' || rating === 'low';
  const isBad = rating === 'high' || rating === 'very-high';

  // === SPECIFIC INDICATORS FIRST (avoid substring collisions) ===

  // Rental market indicators — check BEFORE "air" (Rental Fairness contains "air"!)
  if (n.includes('rental fair') || n.includes('rental market') || n.includes('market depth')) {
    if (isGood) return 'Active rental market — good liquidity and choice.';
    if (isBad) return 'Limited rental market activity — fewer comparable listings.';
    return 'Moderate rental market activity in this area.';
  }
  if (n.includes('rental trend') || n.includes('rent trend')) {
    if (isGood) return 'Rents stable or falling — good for renters.';
    if (isBad) return 'Rents rising fast — expect increases on renewal.';
    return 'Rents tracking inflation.';
  }
  if (n.includes('market heat')) {
    if (isGood) return 'Cool market — more supply, negotiating room.';
    if (isBad) return 'Hot market — high demand, less negotiating power.';
    return 'Balanced market conditions.';
  }

  // Aircraft noise — check BEFORE "air" and "noise" (matches both!)
  if (n.includes('aircraft')) {
    if (isGood) return 'Not under a flight path — minimal aircraft noise.';
    if (isBad) return 'Under a flight path — aircraft noise likely. Visit at peak times.';
    return 'Some aircraft noise — check flight schedules.';
  }

  // School quality — check BEFORE "quality" (generic) and "school" (generic)
  if (n.includes('school') && n.includes('quality')) {
    if (isGood) return 'Good school access — strong EQI scores nearby.';
    if (isBad) return 'Limited school options — consider zoning carefully.';
    return 'Average school access and quality.';
  }

  // School zoning — check BEFORE "school" (generic) and "zone" (generic)
  if (n.includes('school') && n.includes('zon')) {
    if (isGood) return 'In zone for good schools.';
    if (isBad) return 'Not in zone for top schools nearby.';
    return 'Some schools zoned for this address.';
  }

  // === HAZARDS ===
  if (n.includes('flood')) {
    if (isGood) return 'Low flood risk — not in a mapped flood zone.';
    if (isBad) return 'In or near a flood zone. Check insurance and floor level.';
    return 'Some flood risk — review council flood maps.';
  }
  if (n.includes('tsunami')) {
    if (isGood) return 'Low tsunami risk for this location.';
    if (isBad) return 'In a tsunami evacuation zone. Know your evacuation route.';
    return 'Moderate tsunami risk — check civil defence plans.';
  }
  if (n.includes('liquefaction')) {
    if (isGood) return 'Stable ground — low liquefaction risk.';
    if (isBad) return 'Ground may become unstable in a major earthquake. Check foundations.';
    return 'Some ground instability risk in major earthquakes.';
  }
  if (n.includes('epb') || n.includes('earthquake-prone') || n.includes('earthquake prone')) {
    if (isGood) return 'Few earthquake-prone buildings nearby.';
    if (isBad) return 'Many earthquake-prone buildings nearby — older building stock.';
    return 'Some older buildings nearby may need seismic strengthening.';
  }
  if (n.includes('ground') && n.includes('shaking')) {
    if (isGood) return 'Lower earthquake shaking expected here.';
    if (isBad) return 'Strong ground shaking expected in earthquakes.';
    return 'Moderate earthquake shaking expected.';
  }
  if (n.includes('fault zone') || n.includes('fault_zone')) {
    if (isGood) return 'No active fault zone at this address.';
    if (isBad) return 'Within an active fault zone. Check building setback requirements.';
    return 'Near a fault zone — check council overlay maps.';
  }
  if (n.includes('slope') || n.includes('landslide')) {
    if (isGood) return 'Flat or gently sloping terrain — low landslide risk.';
    if (isBad) return 'Steep terrain with landslide risk. Consider geotechnical assessment.';
    return 'Some slope instability risk — check retaining walls.';
  }
  if (n.includes('overland flow') || n.includes('overland_flow')) {
    if (isGood) return 'No overland flow path nearby.';
    if (isBad) return 'Overland flow path crosses property — surface water risk in heavy rain.';
    return 'Overland flow path nearby — surface water may pass during heavy rain.';
  }
  if (n.includes('wildfire')) {
    if (isGood) return 'Low wildfire risk for this location.';
    if (isBad) return 'Elevated wildfire risk — check vegetation clearance.';
    return 'Some wildfire risk — standard for semi-rural areas.';
  }
  if (n.includes('coastal') && n.includes('erosion')) {
    if (isGood) return 'Not at risk from coastal erosion.';
    if (isBad) return 'Coastal erosion risk — may affect property long-term.';
    return 'Some coastal erosion exposure over time.';
  }
  if (n.includes('wind')) {
    if (isGood) return 'Sheltered location — lower wind exposure.';
    if (isBad) return 'High wind exposure — check for draughts and weathertightness.';
    return 'Standard wind exposure for this region.';
  }
  if (n.includes('earthquake') || n.includes('seismic')) {
    if (isGood) return 'Low seismic activity recorded nearby.';
    if (isBad) return 'Significant seismic activity recorded — check building resilience.';
    return 'Moderate seismic activity in this region.';
  }

  // === ENVIRONMENT ===
  if (n.includes('road noise') || (n.includes('noise') && !n.includes('aircraft'))) {
    if (isGood) return 'Quiet area — minimal road noise impact.';
    if (isBad) return 'High road noise — consider double glazing and room orientation.';
    return 'Moderate noise — typical for urban areas.';
  }
  if (n.includes('water') && n.includes('quality')) {
    if (isGood) return 'Good water quality in local waterways.';
    if (isBad) return 'Water quality concerns in local waterways.';
    return 'Moderate water quality in local waterways.';
  }
  if (n.includes('air quality') || n.includes('air_quality')) {
    if (isGood) return 'Good air quality in this area.';
    if (isBad) return 'Air quality concerns — check seasonal pollution.';
    return 'Moderate air quality — typical for the region.';
  }
  if (n.includes('climate')) {
    if (isGood) return 'Minimal climate change impact projected.';
    if (isBad) return 'Higher climate change impacts projected for this area.';
    return 'Moderate climate change impacts expected.';
  }
  if (n.includes('contamina')) {
    if (isGood) return 'No contaminated land concerns nearby.';
    if (isBad) return 'Contaminated land nearby — check council register.';
    return 'Some historic land use concerns nearby.';
  }

  // === LIVEABILITY ===
  if (n.includes('crime')) {
    if (isGood) return 'Lower crime than most comparable areas.';
    if (isBad) return 'Higher crime than average — check security measures.';
    return 'Crime levels typical for this type of area.';
  }
  if (n.includes('nzdep') || n.includes('deprivation')) {
    if (isGood) return 'Low deprivation index — better services and lower crime.';
    if (isBad) return 'Higher deprivation index — fewer services, higher social need.';
    return 'Average deprivation index for New Zealand.';
  }
  if (n.includes('school')) {
    if (isGood) return 'Good school access — multiple options nearby.';
    if (isBad) return 'Limited school options nearby.';
    return 'Some schools accessible from this location.';
  }
  if (n.includes('heritage')) {
    if (isGood) return 'Few heritage restrictions on development.';
    if (isBad) return 'Many heritage-listed buildings — may restrict development.';
    return 'Some heritage considerations in the area.';
  }

  // === TRANSPORT ===
  if (n.includes('transit access') || n.includes('transit_access')) {
    if (isGood) return 'Excellent public transport access nearby.';
    if (isBad) return 'Limited public transport — likely car-dependent.';
    return 'Some public transport options available.';
  }
  if (n.includes('cbd') || n.includes('proximity to cbd')) {
    if (isGood) return 'Close to the CBD — short commute.';
    if (isBad) return 'Far from the CBD — expect longer commutes.';
    return 'Moderate distance to CBD.';
  }
  if (n.includes('rail')) {
    if (isGood) return 'Close to a train station.';
    if (isBad) return 'Far from the nearest train station.';
    return 'Some train access in the area.';
  }
  if (n.includes('bus')) {
    if (isGood) return 'Good bus stop density nearby.';
    if (isBad) return 'Few bus stops in walking distance.';
    return 'Moderate bus coverage.';
  }
  if (n.includes('commute') && n.includes('frequency')) {
    if (isGood) return 'Frequent peak-hour services.';
    if (isBad) return 'Infrequent services — plan trips carefully.';
    return 'Standard peak-hour service frequency.';
  }
  if (n.includes('road safety') || n.includes('crash')) {
    if (isGood) return 'Few road crashes recorded nearby — safer streets.';
    if (isBad) return 'Road safety concern — multiple crashes recorded nearby.';
    return 'Some road crashes recorded nearby.';
  }
  if (n.includes('transit') || n.includes('transport')) {
    if (isGood) return 'Good public transport access.';
    if (isBad) return 'Limited public transport.';
    return 'Some public transport available.';
  }

  // === PLANNING ===
  if (n.includes('height')) {
    if (isGood) return 'Lower height restrictions — less risk of tall neighbours.';
    if (isBad) return 'Higher height limits — may see new tall buildings nearby.';
    return 'Moderate height limits in this zone.';
  }
  if (n.includes('infrastructure')) {
    if (isGood) return 'Few nearby infrastructure projects — stable area.';
    if (isBad) return 'Many infrastructure projects — expect construction activity.';
    return 'Some infrastructure development in the area.';
  }
  if (n.includes('consent')) {
    if (isGood) return 'Low development activity — quiet neighbourhood.';
    if (isBad) return 'High development activity — expect construction and change.';
    return 'Moderate development activity in the area.';
  }
  if (n.includes('zoning') || (n.includes('zone') && n.includes('permissive'))) {
    if (isGood) return 'Restrictive zoning — limited future development.';
    if (isBad) return 'Permissive zoning — significant development may occur.';
    return 'Moderate zoning flexibility.';
  }

  return null;
}

export function IndicatorCard({ indicator }: IndicatorCardProps) {
  const description = getIndicatorDescription(indicator.name, indicator.score, indicator.rating);

  if (!indicator.is_available) {
    return (
      <div className="rounded-xl border border-dashed border-border p-3.5 opacity-50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{indicator.name}</span>
          <Badge variant="outline" className="text-xs">No data</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-2.5 sm:p-3.5 card-elevated">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <RiskIcon rating={indicator.rating} />
          <span className="text-sm font-semibold">{indicator.name}</span>
        </div>
        <Badge variant={badgeVariant(indicator.rating)} className="text-xs sm:text-xs shrink-0">
          {ratingLabel(indicator.rating)}
        </Badge>
      </div>
      {/* Plain-English description — replaces numeric score bar */}
      {description && (
        <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{description}</p>
      )}
    </div>
  );
}
