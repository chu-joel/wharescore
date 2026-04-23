'use client';

import { Waves, TrendingDown } from 'lucide-react';

export type CoastalTier = 'happens_now' | 'within_30_years' | 'longer_term' | 'not_applicable';

export interface CoastalScenarioPoint {
  year: number;
  slr_cm: number;
}

export interface CoastalScenario {
  label: string;
  description: string;
  points: CoastalScenarioPoint[];
}

export interface CoastalExposure {
  tier: CoastalTier;
  ground_elevation_m: number;
  coast_distance_m: number | null;
  storm_tide_100yr_distance_m: number | null;
  vlm_mm_yr: number | null;
  scenarios: CoastalScenario[];
  headline: string;
  narrative: string;
  // Renter-specific narrative. Skips price/insurance-premium talk and
  // focuses on life-safety, evacuation, and contents cover.
  narrative_renter?: string;
  score_impact: {
    delta: number;
    max_possible: number;
    suppressed_by_council_layer: boolean;
  };
}

interface Props {
  coastal: CoastalExposure | null;
  persona?: 'renter' | 'buyer';
}

const TIER_LABELS: Record<CoastalTier, string> = {
  happens_now: 'Happens now',
  within_30_years: 'Within 30 years',
  longer_term: 'Longer-term',
  not_applicable: 'Not applicable',
};

const TIER_STYLES: Record<CoastalTier, { pill: string; ring: string; icon: string }> = {
  happens_now: {
    pill: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    ring: 'border-red-500',
    icon: 'text-red-600',
  },
  within_30_years: {
    pill: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    ring: 'border-amber-500',
    icon: 'text-amber-600',
  },
  longer_term: {
    pill: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    ring: 'border-blue-500',
    icon: 'text-blue-600',
  },
  not_applicable: {
    pill: 'bg-muted text-muted-foreground',
    ring: 'border-border',
    icon: 'text-muted-foreground',
  },
};

export function HostedCoastalTimeline({ coastal, persona }: Props) {
  if (!coastal || coastal.tier === 'not_applicable') return null;

  // Renter persona only sees the Happens-now tier (life-safety). Everything
  // else in this section is buyer-horizon material.
  if (persona === 'renter' && coastal.tier !== 'happens_now') return null;

  const style = TIER_STYLES[coastal.tier];

  return (
    <section className={`bg-card rounded-xl border-2 ${style.ring} p-6`}>
      <header className="flex items-start gap-3 mb-4">
        <Waves className={`h-6 w-6 shrink-0 mt-0.5 ${style.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h2 className="text-lg font-bold">Coastal exposure</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.pill}`}>
              {TIER_LABELS[coastal.tier]}
            </span>
            {coastal.score_impact.delta > 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.pill}`}>
                +{coastal.score_impact.delta} Hazards
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground">{coastal.headline}</p>
        </div>
      </header>

      <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line mb-6">
        {persona === 'renter' && coastal.narrative_renter ? coastal.narrative_renter : coastal.narrative}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
        <Stat label="Height above high tide" value={`${coastal.ground_elevation_m.toFixed(1)}m`} />
        {coastal.coast_distance_m != null && (
          <Stat label="Distance to the coast" value={formatCoastDistance(coastal.coast_distance_m)} />
        )}
        {coastal.storm_tide_100yr_distance_m != null && (
          <Stat
            label="A big storm reaches within"
            value={`${coastal.storm_tide_100yr_distance_m}m`}
          />
        )}
        {coastal.vlm_mm_yr != null && Math.abs(coastal.vlm_mm_yr) >= 0.5 && (
          <Stat
            label="The ground here is"
            value={coastal.vlm_mm_yr < 0 ? 'sinking slowly' : 'rising slowly'}
            icon={coastal.vlm_mm_yr < -0.5 ? <TrendingDown className="h-3.5 w-3.5" /> : undefined}
          />
        )}
      </div>

      <details className="border-t border-border pt-4 mb-4 group">
        <summary className="text-sm font-semibold cursor-pointer list-none flex items-center justify-between">
          <span>How much higher will the sea be here?</span>
          <span className="text-xs text-muted-foreground group-open:hidden">Show details</span>
          <span className="text-xs text-muted-foreground hidden group-open:inline">Hide</span>
        </summary>
        <div className="mt-3">
          <ScenarioTable scenarios={coastal.scenarios} />
        </div>
      </details>

      <details className="border-t border-border pt-4 group">
        <summary className="text-sm font-semibold cursor-pointer list-none flex items-center justify-between">
          <span>How this affected the score</span>
          <span className="text-xs text-muted-foreground group-open:hidden">Show details</span>
          <span className="text-xs text-muted-foreground hidden group-open:inline">Hide</span>
        </summary>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2">
          Coastal risk can move the Hazards score by up to {coastal.score_impact.max_possible} points.
          This property moved {coastal.score_impact.delta}
          {coastal.score_impact.suppressed_by_council_layer
            ? '. Softened because a council map already flags this property for coastal hazard.'
            : '.'}
        </p>
      </details>

      <p className="text-xs text-muted-foreground/60 mt-4">
        Source:{' '}
        <a
          href="https://searise.nz/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-piq-primary"
        >
          NZ SeaRise
        </a>{' '}
        (sea level projections) ·{' '}
        <a
          href="https://niwa.co.nz/hazards/coastal-hazards/extreme-coastal-flood-maps-aotearoa-new-zealand"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-piq-primary"
        >
          NIWA
        </a>{' '}
        (storm tide modelling)
      </p>
    </section>
  );
}

function formatCoastDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-semibold flex items-center gap-1">
        {icon}
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ScenarioTable({ scenarios }: { scenarios: CoastalScenario[] }) {
  const years = Array.from(
    new Set(scenarios.flatMap(s => s.points.map(p => p.year)))
  ).sort();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left font-medium py-2 pr-3">Scenario</th>
            {years.map(y => (
              <th key={y} className="text-right font-medium py-2 px-2">
                By {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scenarios.map(s => (
            <tr key={s.label} className="border-b border-border/50 last:border-0">
              <td className="py-2 pr-3">
                <div className="font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.description}</div>
              </td>
              {years.map(y => {
                const point = s.points.find(p => p.year === y);
                return (
                  <td key={y} className="text-right py-2 px-2 font-mono tabular-nums">
                    {point ? `+${point.slr_cm}cm` : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Mock data for preview / Storybook. Not used in production. Backend will
// emit the same shape from snapshot_generator once SeaRise + NIWA data lands.
export const MOCK_COASTAL_SEVERE: CoastalExposure = {
  tier: 'happens_now',
  ground_elevation_m: 2.1,
  coast_distance_m: 180,
  storm_tide_100yr_distance_m: 40,
  vlm_mm_yr: -2.1,
  headline: 'Big storms already come within 40m of this property',
  narrative:
    "The section sits 2.1m above high tide, 180m from the coast. A once-a-century storm already pushes water to within 40m of the house. A slightly bigger storm would reach it.\n\nBy the 2050s the sea here is projected to rise about 28cm on the current emissions path. That puts the once-a-century storm line onto the property, and a much more common storm within reach of the house by the 2070s.\n\nWhat this means: talk to your insurer now about cover for this address, and whether they'll still cover it in 15 years. Insurers typically lift excess or pull cover well before flooding becomes frequent.",
  narrative_renter:
    "The section sits 2.1m above high tide, 180m from the coast. A once-a-century storm already pushes water to within 40m of the house. A slightly bigger storm would reach it.\n\nBy the 2050s the sea here is projected to rise about 28cm, bringing storm water onto the property.\n\nWhat this means: know your evacuation route. Check that your contents insurance covers flood, many basic policies don't. Ask the landlord whether this property has flooded before.",
  score_impact: { delta: 12, max_possible: 15, suppressed_by_council_layer: false },
  scenarios: [
    {
      label: 'Strong global action',
      description: 'Paris 1.5-2°C targets met',
      points: [
        { year: 2050, slr_cm: 23 },
        { year: 2100, slr_cm: 48 },
        { year: 2150, slr_cm: 64 },
      ],
    },
    {
      label: 'Current trajectory',
      description: 'Present-day policy path',
      points: [
        { year: 2050, slr_cm: 28 },
        { year: 2100, slr_cm: 67 },
        { year: 2150, slr_cm: 96 },
      ],
    },
    {
      label: 'High emissions',
      description: "If emissions don't decline",
      points: [
        { year: 2050, slr_cm: 31 },
        { year: 2100, slr_cm: 112 },
        { year: 2150, slr_cm: 178 },
      ],
    },
  ],
};
