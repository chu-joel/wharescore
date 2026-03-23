'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const SCORE_BINS = [
  { label: 'Very Low', range: '0–20', color: '#C42D2D' },
  { label: 'Low', range: '21–40', color: '#D55E00' },
  { label: 'Moderate', range: '41–60', color: '#E69F00' },
  { label: 'High', range: '61–80', color: '#56B4E9' },
  { label: 'Very High', range: '81–100', color: '#0D7377' },
];

const CATEGORIES = [
  { name: 'Hazards', weight: 30, color: '#DC2626' },
  { name: 'Liveability', weight: 25, color: '#F59E0B' },
  { name: 'Environment', weight: 15, color: '#10B981' },
  { name: 'Market', weight: 15, color: '#3B82F6' },
  { name: 'Planning', weight: 15, color: '#8B5CF6' },
];

export function HostedMethodology() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <h3 className="text-lg font-bold">Methodology & Sources</h3>
        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-5">
          <div>
            <h4 className="text-sm font-semibold mb-2">How Scores Are Computed</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              WhareScore computes a composite risk score (0–100) using a weighted average of five
              category scores: Hazards (30%), Liveability (25%), Environment (15%), Market (15%),
              and Planning (15%). Higher scores indicate lower risk. Each category is derived from
              normalised sub-indicators — for example, Hazards aggregates flood zone presence,
              liquefaction class, seismic activity, wind zone, tsunami zone, wildfire danger days,
              coastal erosion risk, earthquake-prone building proximity, and slope failure susceptibility.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Score Scale</h4>
            <div className="flex rounded-lg overflow-hidden h-6">
              {SCORE_BINS.map((bin) => (
                <div
                  key={bin.label}
                  className="flex-1 flex items-center justify-center"
                  style={{ backgroundColor: bin.color }}
                >
                  <span className="text-[9px] font-bold text-white">{bin.label}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Category Weights</h4>
            <div className="flex gap-1.5">
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.name}
                  className="rounded-lg flex items-center justify-center py-1.5 text-white text-[10px] font-bold"
                  style={{ backgroundColor: cat.color, flex: cat.weight }}
                >
                  {cat.name} {cat.weight}%
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Data Sources</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This report draws on 12+ government open data sources including LINZ Property Titles &
              Valuations, GWRC Hazard Maps, MBIE Earthquake-Prone Buildings Register, NZTA Road Noise,
              MBIE Tenancy Bond Data, Stats NZ NZDep Index, NZ Police Crime Victimisations, GTFS Public
              Transport Feeds, MoE School Directory, LAWA Water & Air Quality, NIWA Climate Projections,
              and GWRC Contaminated Land (SLUR).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
