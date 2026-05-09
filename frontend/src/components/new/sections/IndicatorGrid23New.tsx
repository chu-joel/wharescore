'use client';

import type { PropertyReport } from '@/lib/types';
import { Card, CardHead, IndicatorChip, indToneFor } from '@/components/new/ui/primitives';

/**
 * Renders every indicator across all categories.
 * Reads scores.categories[].indicators (IndicatorScore[]).
 */
export function IndicatorGrid23New({ report }: { report: PropertyReport }) {
  const cats = report.scores?.categories ?? [];
  const all = cats.flatMap((c) => c.indicators ?? []);
  if (all.length === 0) return null;

  return (
    <Card>
      <CardHead title="All indicators" meta={`${all.length} layers`} />
      <div className="ws-card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {all.map((ind) => {
            const lowerIsBetter = /crime|nzdep/i.test(ind.name);
            const tone = indToneFor(ind.score, lowerIsBetter);
            return (
              <IndicatorChip
                key={ind.name}
                name={prettyName(ind.name)}
                value={ind.score}
                suffix="/100"
                tone={tone}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function prettyName(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
