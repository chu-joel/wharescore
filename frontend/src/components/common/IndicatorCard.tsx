'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getRatingColor } from '@/lib/constants';
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
  if (n.includes('slope') || n.includes('landslide')) {
    if (isGood) return 'Flat or gently sloping terrain — low landslide risk.';
    if (isBad) return 'Steep terrain with landslide risk. Consider geotechnical assessment.';
    return 'Some slope instability risk — check retaining walls.';
  }
  if (n.includes('crime')) {
    if (isGood) return 'Lower crime than most comparable areas.';
    if (isBad) return 'Higher crime than average — check security measures.';
    return 'Crime levels typical for this type of area.';
  }
  if (n.includes('noise')) {
    if (isGood) return 'Quiet area — minimal road noise impact.';
    if (isBad) return 'High road noise — consider double glazing and room orientation.';
    return 'Moderate noise — typical for urban areas.';
  }
  if (n.includes('transit') || n.includes('transport')) {
    // Higher score = worse transport access (consistent with all other categories)
    if (isGood) return 'Excellent public transport access nearby.';
    if (isBad) return 'Limited public transport — likely car-dependent.';
    return 'Some public transport options available.';
  }
  if (n.includes('crash')) {
    if (isGood) return 'Few road crashes recorded nearby — safer streets.';
    if (isBad) return 'Road safety concern — multiple crashes recorded nearby.';
    return 'Some road crashes recorded nearby.';
  }
  if (n.includes('wind')) {
    if (isGood) return 'Sheltered location — lower wind exposure.';
    if (isBad) return 'High wind exposure — check for draughts and weathertightness.';
    return 'Standard wind exposure for this region.';
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
  if (n.includes('water') && n.includes('quality')) {
    if (isGood) return 'Good water quality in local waterways.';
    if (isBad) return 'Water quality concerns in local waterways.';
    return 'Moderate water quality in local waterways.';
  }
  if (n.includes('air') || (n.includes('quality') && !n.includes('water'))) {
    if (isGood) return 'Good air quality in this area.';
    if (isBad) return 'Air quality concerns — check seasonal pollution.';
    return 'Moderate air quality — typical for the region.';
  }
  if (n.includes('water')) {
    if (isGood) return 'Good water quality in local waterways.';
    if (isBad) return 'Water quality concerns in local waterways.';
    return 'Moderate water quality in local waterways.';
  }
  if (n.includes('climate')) {
    if (isGood) return 'Minimal climate change impact projected.';
    if (isBad) return 'Higher climate change impacts projected for this area.';
    return 'Moderate climate change impacts expected.';
  }
  if (n.includes('ground') && n.includes('shaking')) {
    if (isGood) return 'Lower earthquake shaking expected here.';
    if (isBad) return 'Strong ground shaking expected in earthquakes.';
    return 'Moderate earthquake shaking expected.';
  }
  if (n.includes('earthquake') && !n.includes('prone')) {
    if (isGood) return 'Low seismic activity recorded nearby.';
    if (isBad) return 'Significant seismic activity recorded — check building resilience.';
    return 'Moderate seismic activity in this region.';
  }
  if (n.includes('contamina')) {
    if (isGood) return 'No contaminated land concerns nearby.';
    if (isBad) return 'Contaminated land nearby — check council register.';
    return 'Some historic land use concerns nearby.';
  }
  if (n.includes('nzdep') || n.includes('deprivation')) {
    if (isGood) return 'Low deprivation area — better services and lower crime.';
    if (isBad) return 'Higher deprivation area — fewer services, higher social need.';
    return 'Average deprivation level for New Zealand.';
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
  if (n.includes('height')) {
    if (isGood) return 'Lower height restrictions — development potential limited.';
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
  if (n.includes('zone') && n.includes('permissive')) {
    if (isGood) return 'Restrictive zoning — limited future development.';
    if (isBad) return 'Permissive zoning — significant development may occur.';
    return 'Moderate zoning flexibility.';
  }
  return null;
}

export function IndicatorCard({ indicator }: IndicatorCardProps) {
  const color = getRatingColor(indicator.rating);
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
    <TooltipProvider>
      <div className="rounded-xl border border-border bg-card p-2.5 sm:p-3.5 card-elevated">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <RiskIcon rating={indicator.rating} />
            <span className="text-sm font-semibold">{indicator.name}</span>
          </div>
          <Badge variant={badgeVariant(indicator.rating)} className="text-xs sm:text-xs shrink-0">
            {indicator.value}
          </Badge>
        </div>
        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{description}</p>
        )}
        {/* Score bar */}
        <div className="mt-1.5 sm:mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${indicator.score}%`,
                background: `linear-gradient(90deg, #0D7377, ${color})`,
              }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums w-7 text-right">
            {Math.round(indicator.score)}
          </span>
        </div>
        {/* Source */}
        {indicator.source && (
          <Tooltip>
            <TooltipTrigger
              className="text-xs text-muted-foreground/70 mt-1.5 cursor-default block text-left"
            >
              {indicator.source}
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Updated: {indicator.updated || 'Recently'}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
