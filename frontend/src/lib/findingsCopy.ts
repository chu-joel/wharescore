import type { Finding, ScoreBucket } from '@/components/property/FindingCard';

export type FindingCopy = Pick<
  Finding,
  'headline' | 'interpretation' | 'severity' | 'category' | 'source' | 'sourceUrl' | 'tier'
> & {
  scoreImpact?: { bucket: ScoreBucket; delta: number };
};

type CopyFn<T extends Record<string, unknown> = Record<string, never>> = (args: T) => FindingCopy;

const LINZ_URL = 'https://www.linz.govt.nz/guidance/property-ownership/types-property-ownership';
const SEARISE_URL = 'https://searise.nz/';
const NIWA_COASTAL_URL = 'https://niwa.co.nz/hazards/coastal-hazards/extreme-coastal-flood-maps-aotearoa-new-zealand';
const COASTAL_COMBINED_SOURCE = 'NZ SeaRise · NIWA Extreme Coastal Flood Maps';

export const FINDINGS: Record<string, FindingCopy | CopyFn<any>> = {
  cross_lease: {
    headline: 'Cross-lease title: you share the land with the other flats',
    interpretation:
      "You don't own the land outright. The flats on the section share ownership, and any structural change outside the flat plan needs everyone's agreement. Common trip-up: decks, extensions, or converted garages that weren't on the original plan can block a sale or refinance later. Get the flats plan and confirm the actual structure matches it before signing.",
    severity: 'warning',
    category: 'Planning',
    source: 'LINZ Property Titles',
    sourceUrl: LINZ_URL,
  },

  leasehold: {
    headline: 'Leasehold title: you own the house, not the land',
    interpretation:
      'Ground rent usually resets every 7-21 years and can jump 20-50% at review. Fewer banks lend on leasehold, and those that do may offer shorter terms. Before making an offer ask for: the current ground rent, the next review date, and who the lessor is. Build the worst-case future ground rent into your affordability calculation.',
    severity: 'critical',
    category: 'Planning',
    source: 'LINZ Property Titles',
    sourceUrl: LINZ_URL,
  },

  flood_in_zone: ((args: { label: string }) => ({
    headline: `This property is in a mapped flood zone (${args.label})`,
    interpretation:
      "Rain heavy enough to overwhelm local drainage has been modelled to reach this property. Practical steps: check whether your contents insurance actually covers flood (many basic policies exclude it or charge a higher excess), know your evacuation route, and ask the agent or landlord directly whether this property has flooded before. The flood map tells you what's possible; previous events tell you what's happened.",
    severity: 'critical',
    category: 'Hazards',
    source: 'Regional Council Flood Maps',
  })) as CopyFn<{ label: string }>,

  flood_near_zone: ((args: { distance_m: number }) => ({
    headline: `Only ${args.distance_m}m from a mapped flood zone`,
    interpretation:
      'Not in the modelled flood zone itself, but close enough that a slightly worse storm than the maps anticipate could reach here. Flood maps are probabilistic, not a guarantee of immunity beyond their boundary. Worth asking the agent about the property\'s flood history and confirming your insurance covers flood damage.',
    severity: 'warning',
    category: 'Hazards',
    source: 'Regional Council Flood Maps',
  })) as CopyFn<{ distance_m: number }>,

  liquefaction_very_high: ((args: { raw: string }) => ({
    headline: `Very high liquefaction susceptibility (${args.raw})`,
    interpretation:
      'The ground here is very likely to deform during a major earthquake, the same phenomenon that damaged thousands of Christchurch homes in 2011. Foundation requirements are stricter, and insurance excesses for earthquake damage can be higher. Commission a geotechnical assessment ($2,000-$5,000) before going unconditional; the number you get back directly affects what the house is worth and what it would cost to repair.',
    severity: 'critical',
    category: 'Hazards',
    source: 'Regional Council Liquefaction Maps',
  })) as CopyFn<{ raw: string }>,

  liquefaction_high: ((args: { raw: string }) => ({
    headline: `High liquefaction susceptibility (${args.raw})`,
    interpretation:
      'Significant ground deformation is possible during a major earthquake. Stricter foundation requirements apply. Talk to a geotechnical engineer before going unconditional. The cost (roughly $2,000-$3,000) is small relative to the decision. Review the foundation type and any past earthquake repair history.',
    severity: 'warning',
    category: 'Hazards',
    source: 'Regional Council Liquefaction Maps',
  })) as CopyFn<{ raw: string }>,

  liquefaction_moderate: ((args: { raw: string }) => ({
    headline: `Moderate liquefaction susceptibility (${args.raw})`,
    interpretation:
      'Some ground settlement is possible in a significant earthquake. Not a deal-breaker, but worth having a standard building inspection pay attention to any existing foundation movement cracks and drainage issues around the house.',
    severity: 'info',
    category: 'Hazards',
    source: 'Regional Council Liquefaction Maps',
  })) as CopyFn<{ raw: string }>,

  // Coastal exposure: SLR + storm tide
  // Triggered by get_property_report() once sea_level_rise + extreme_coastal_flood
  // tables are populated. Voice: present-tense, no scenario codes, cm for small
  // values, decades not dates. Score deltas feed the Hazards bucket and get
  // halved when coastal_inundation_ranking or coastal_erosion already fires.

  coastal_storm_imminent: ((args: {
    storm_tide_distance_m: number;
    elevation_m: number;
    slr_2050_cm: number;
  }) => ({
    headline: `Big storms already come within ${args.storm_tide_distance_m}m of this property`,
    interpretation:
      `The section sits ${args.elevation_m.toFixed(1)}m above high tide. A once-a-century storm already pushes water to within ${args.storm_tide_distance_m}m of the house. A slightly bigger storm would reach it.\n\nBy the 2050s the sea here is projected to rise about ${args.slr_2050_cm}cm on the current emissions path, putting the once-a-century storm onto the property and a much more common storm within reach by the 2070s.\n\n**What this means:** Talk to your insurer now about cover for this address and whether they'll still cover it in 15 years. Insurers lift excess or pull cover well before flooding becomes frequent.`,
    severity: 'critical',
    category: 'Hazards',
    tier: 'Happens now',
    scoreImpact: { bucket: 'Hazards', delta: 12 },
    source: COASTAL_COMBINED_SOURCE,
    sourceUrl: NIWA_COASTAL_URL,
  })) as CopyFn<{ storm_tide_distance_m: number; elevation_m: number; slr_2050_cm: number }>,

  coastal_storm_by_2050: ((args: {
    elevation_m: number;
    slr_2050_cm: number;
  }) => ({
    headline: 'The same size storms will reach the house within 20 years',
    interpretation:
      `The section sits ${args.elevation_m.toFixed(1)}m above high tide. By the 2050s the sea here is projected to rise about ${args.slr_2050_cm}cm on the current emissions path, enough that a once-a-century storm reaches the property without having to be any bigger than storms we see today.\n\n**What this means:** The practical impact lands well before the water does. Insurers reprice flood-exposed properties 10-15 years before events become frequent. If you're holding through the 2040s, assume premiums rise and cover narrows.`,
    severity: 'critical',
    category: 'Hazards',
    tier: 'Within 30 years',
    scoreImpact: { bucket: 'Hazards', delta: 10 },
    source: COASTAL_COMBINED_SOURCE,
    sourceUrl: NIWA_COASTAL_URL,
  })) as CopyFn<{ elevation_m: number; slr_2050_cm: number }>,

  coastal_storm_amplified: ((args: {
    coast_distance_m: number;
    slr_2050_cm: number;
  }) => ({
    headline: 'Storms here will do more damage as the sea rises',
    interpretation:
      `The property is ${args.coast_distance_m}m from the coast. A higher starting sea level means the same storms push water further inland, about ${args.slr_2050_cm}cm more reach by the 2050s on the current emissions path. Today's 1-in-100-year event becomes a 1-in-10-year event within a few decades without storms getting any bigger.\n\n**What this means:** Not an immediate problem, but worth factoring into long-term hold horizons. Check drainage, any coastal retaining walls, and how the property handles storm events.`,
    severity: 'warning',
    category: 'Hazards',
    tier: 'Within 30 years',
    scoreImpact: { bucket: 'Hazards', delta: 6 },
    source: COASTAL_COMBINED_SOURCE,
    sourceUrl: NIWA_COASTAL_URL,
  })) as CopyFn<{ coast_distance_m: number; slr_2050_cm: number }>,

  coastal_land_sinking: ((args: { vlm_mm_yr: number }) => ({
    headline: 'The ground here is sinking, so sea level rises faster than most of NZ',
    interpretation:
      `The land at this point is subsiding about ${Math.abs(args.vlm_mm_yr).toFixed(1)}mm a year. Relative to the house that compounds whatever the sea does: the global 30cm-by-2050 projection becomes closer to ${(30 + Math.abs(args.vlm_mm_yr) * 25).toFixed(0)}cm here over the same window.\n\n**What this means:** Flooding, insurance repricing, and erosion milestones all arrive sooner here than national figures suggest. A reason to shorten your mental time-horizon.`,
    severity: 'warning',
    category: 'Hazards',
    tier: 'Within 30 years',
    scoreImpact: { bucket: 'Hazards', delta: 5 },
    source: 'NZ SeaRise (vertical land motion)',
    sourceUrl: SEARISE_URL,
  })) as CopyFn<{ vlm_mm_yr: number }>,

  coastal_long_horizon: ((args: {
    slr_2100_cm_high: number;
    slr_2100_cm_mid: number;
  }) => ({
    headline: 'Notably higher sea level here by the end of the century',
    interpretation:
      `On the current emissions path, sea level at this point is projected to be about ${args.slr_2100_cm_mid}cm higher by 2100. Under a worst-case scenario it's closer to ${args.slr_2100_cm_high}cm. Beyond most ownership horizons, but it affects resale to the next buyer who will have a shorter runway than you did.\n\n**What this means:** Probably not decision-relevant for a 10-15 year hold. Worth noting for multi-generational holds or long-dated leasehold takeovers.`,
    severity: 'info',
    category: 'Hazards',
    tier: 'Longer-term',
    scoreImpact: { bucket: 'Hazards', delta: 1 },
    source: 'NZ SeaRise',
    sourceUrl: SEARISE_URL,
  })) as CopyFn<{ slr_2100_cm_high: number; slr_2100_cm_mid: number }>,
};

export function resolveCopy<T extends Record<string, unknown>>(
  key: keyof typeof FINDINGS,
  args?: T,
): FindingCopy {
  const entry = FINDINGS[key];
  if (typeof entry === 'function') return (entry as CopyFn<T>)(args ?? ({} as T));
  return entry;
}
