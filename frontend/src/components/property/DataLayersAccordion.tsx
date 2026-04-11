'use client';

import { Layers, Check } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { CoverageRing } from './CoverageRing';
import type { CoverageInfo } from '@/lib/types';

// Human-readable labels for indicator keys
const INDICATOR_LABELS: Record<string, string> = {
  flood: 'Flood Risk',
  tsunami: 'Tsunami Zone',
  liquefaction: 'Liquefaction',
  slope_failure: 'Slope Stability',
  earthquake: 'Seismic Activity',
  coastal_erosion: 'Coastal Erosion',
  wind: 'Wind Zone',
  wildfire: 'Wildfire Risk',
  epb: 'Earthquake-Prone Buildings',
  ground_shaking: 'Ground Shaking',
  fault_zone: 'Fault Zone',
  landslide_susceptibility: 'Landslide Susceptibility',
  overland_flow: 'Overland Flow Path',
  aircraft_noise: 'Aircraft Noise',
  coastal_erosion_council: 'Coastal Erosion (Council)',
  noise: 'Road Noise',
  air_quality: 'Air Quality',
  water_quality: 'Water Quality',
  climate: 'Climate Projection',
  contaminated_land: 'Contaminated Land',
  crime: 'Crime Rate',
  nzdep: 'Deprivation Index',
  schools: 'School Quality',
  heritage: 'Heritage Sites',
  transit_access: 'Transit Access',
  cbd_proximity: 'CBD Proximity',
  commute_frequency: 'Commute Frequency',
  rail_proximity: 'Rail Proximity',
  bus_density: 'Bus Density',
  road_safety: 'Road Safety',
  rental_fairness: 'Rental Market Depth',
  rental_trend: 'Rental Trend',
  market_heat: 'Market Heat',
  zone_permissiveness: 'Zoning',
  height_limit: 'Height Limit',
  resource_consents: 'Resource Consents',
  infrastructure: 'Infrastructure Projects',
  school_zone: 'School Zoning',
};

const CATEGORY_LABELS: Record<string, string> = {
  hazards: 'Natural Hazards',
  environment: 'Environment',
  liveability: 'Liveability',
  transport: 'Transport & Access',
  market: 'Rental Market',
  planning: 'Planning & Zoning',
};

const CATEGORY_ORDER = ['hazards', 'environment', 'liveability', 'transport', 'market', 'planning'];

const BONUS_LABELS: Record<string, string> = {
  ai_insights: 'AI-Powered Insights',
  council_valuation: 'Council Valuation (CV)',
  national_earthquake: 'National Earthquake Data',
  national_climate: 'National Climate Projections',
  national_wind: 'National Wind Zones',
};

interface DataLayersAccordionProps {
  coverage: CoverageInfo;
  compact?: boolean;
}

export function DataLayersAccordion({ coverage, compact }: DataLayersAccordionProps) {
  const totalWithBonus = coverage.available + (coverage.bonus_features?.length ?? 0);

  if (compact) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-3.5 w-3.5 text-piq-primary shrink-0" />
          <span className="text-xs font-medium">{totalWithBonus} risk checks completed for this property</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {CATEGORY_ORDER.map((cat) => {
            const data = coverage.per_category[cat];
            if (!data || data.available === 0) return null;
            return (
              <span key={cat} className="text-xs text-muted-foreground">
                <Check className="inline h-3 w-3 text-piq-success mr-0.5 -mt-0.5" />
                {CATEGORY_LABELS[cat] ?? cat} ({data.available})
              </span>
            );
          })}
          {coverage.bonus_features?.map((f) => (
            <span key={f} className="text-xs text-muted-foreground">
              <Check className="inline h-3 w-3 text-piq-success mr-0.5 -mt-0.5" />
              {BONUS_LABELS[f] ?? f}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Accordion>
      <AccordionItem value="data-layers" className="border-none">
        <AccordionTrigger className="py-2 hover:no-underline">
          <div className="flex items-center gap-2.5">
            <CoverageRing
              available={totalWithBonus}
              total={coverage.total + (coverage.bonus_features?.length ?? 0)}
              percentage={coverage.percentage}
            />
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3 pl-1">
            {/* Indicator categories */}
            {CATEGORY_ORDER.map((cat) => {
              const data = coverage.per_category[cat];
              if (!data || data.available === 0) return null;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{CATEGORY_LABELS[cat] ?? cat}</span>
                    <span className="text-xs text-muted-foreground">{data.available} of {data.total}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.indicators.map((ind) => (
                      <span
                        key={ind}
                        className="inline-flex items-center gap-1 rounded-full bg-piq-primary/10 px-2 py-0.5 text-xs text-piq-primary"
                      >
                        <Check className="h-2.5 w-2.5" />
                        {INDICATOR_LABELS[ind] ?? ind}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Bonus features */}
            {coverage.bonus_features && coverage.bonus_features.length > 0 && (
              <div>
                <div className="mb-1">
                  <span className="text-xs font-medium">Also included</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {coverage.bonus_features.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 rounded-full bg-piq-success/10 px-2 py-0.5 text-xs text-piq-success"
                    >
                      <Check className="h-2.5 w-2.5" />
                      {BONUS_LABELS[f] ?? f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
