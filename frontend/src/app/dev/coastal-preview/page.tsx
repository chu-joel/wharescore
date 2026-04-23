'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import {
  HostedCoastalTimeline,
  MOCK_COASTAL_SEVERE,
  type CoastalExposure,
  type CoastalTier,
} from '@/components/report/HostedCoastalTimeline';

// Dev-only preview. No backend required. Visit /dev/coastal-preview to
// eyeball the coastal section against mock data before the SeaRise + NIWA
// pipeline lands.

const TIERS: CoastalTier[] = ['happens_now', 'within_30_years', 'longer_term', 'not_applicable'];

function mockFor(tier: CoastalTier): CoastalExposure {
  const base = { ...MOCK_COASTAL_SEVERE };
  if (tier === 'happens_now') return base;
  if (tier === 'within_30_years') {
    return {
      ...base,
      tier: 'within_30_years',
      ground_elevation_m: 4.8,
      coast_distance_m: 420,
      storm_tide_100yr_distance_m: 140,
      vlm_mm_yr: -0.8,
      headline: 'Within 20 years big storms will start reaching the property',
      narrative:
        "The section sits 4.8m above high tide, 420m from the coast. Today a once-a-century storm stops about 140m short.\n\nBy the 2050s the sea here is projected to rise around 28cm on the current emissions path, enough that the same size storm will start reaching the section.\n\nWhat this means: insurers reprice flood-exposed properties 10-15 years before events become frequent. Worth asking what they'll still cover in 15 years.",
      score_impact: { delta: 7, max_possible: 15, suppressed_by_council_layer: false },
    };
  }
  if (tier === 'longer_term') {
    return {
      ...base,
      tier: 'longer_term',
      ground_elevation_m: 12.3,
      coast_distance_m: 1800,
      storm_tide_100yr_distance_m: null,
      vlm_mm_yr: null,
      headline: 'Notably higher sea level here by the end of the century',
      narrative:
        "On the current emissions path sea level at this point is projected to be around 67cm higher by 2100. Under a worst-case scenario it's closer to 112cm.\n\nBeyond most ownership horizons, but it affects resale to the next buyer who will have a shorter runway than you did.\n\nWhat this means: probably not decision-relevant for a 10-15 year hold. Worth noting for multi-generational holds.",
      score_impact: { delta: 1, max_possible: 15, suppressed_by_council_layer: false },
    };
  }
  return { ...base, tier: 'not_applicable' };
}

export default function CoastalPreviewPage() {
  // Dev-only route. Returns 404 in production so the mock preview is not
  // publicly reachable on wharescore.co.nz.
  if (process.env.NODE_ENV === 'production') notFound();

  const [tier, setTier] = useState<CoastalTier>('happens_now');
  const [persona, setPersona] = useState<'buyer' | 'renter'>('buyer');
  const [suppressed, setSuppressed] = useState(false);

  const coastal = { ...mockFor(tier) };
  coastal.score_impact = {
    ...coastal.score_impact,
    suppressed_by_council_layer: suppressed,
    delta: suppressed ? Math.floor(coastal.score_impact.delta / 2) : coastal.score_impact.delta,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Coastal Timeline - Dev Preview</h1>
          <p className="text-sm text-muted-foreground">
            Mock data. Not a real report. Use the controls to flip tiers / persona / council-layer suppression.
          </p>
        </header>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground w-16">Tier</span>
            {TIERS.map(t => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tier === t
                    ? 'bg-piq-primary text-white'
                    : 'bg-muted text-foreground hover:bg-muted/70'
                }`}
              >
                {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground w-16">Persona</span>
            {(['buyer', 'renter'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPersona(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  persona === p
                    ? 'bg-piq-primary text-white'
                    : 'bg-muted text-foreground hover:bg-muted/70'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-16">Extras</span>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={suppressed}
                onChange={(e) => setSuppressed(e.target.checked)}
                className="rounded"
              />
              Halve score (council layer already firing)
            </label>
          </div>
        </div>

        {tier === 'not_applicable' && (
          <p className="text-sm text-muted-foreground italic px-2">
            Tier is not_applicable, the section renders nothing (correct behaviour for inland properties).
          </p>
        )}
        {persona === 'renter' && tier !== 'happens_now' && tier !== 'not_applicable' && (
          <p className="text-sm text-muted-foreground italic px-2">
            Renter persona only sees happens_now (life-safety). For {tier.replace(/_/g, ' ')} the section is hidden.
          </p>
        )}

        <HostedCoastalTimeline coastal={coastal} persona={persona} />
      </div>
    </div>
  );
}
