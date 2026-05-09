'use client';

import type { PropertyReport } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

/**
 * Data coverage transparency. Reads coverage.per_category to render a grid
 * showing how many indicators are available per category.
 */
export function CoverageNew({ report }: { report: PropertyReport }) {
  const cov = report.coverage;
  if (!cov) return null;
  const per = cov.per_category ?? {};

  return (
    <Card>
      <CardHead title="Data coverage" meta={`${cov.percentage}% confidence`} />
      <div className="ws-card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {Object.entries(per).map(([cat, c]) => (
            <div key={cat} style={{
              border: '1px solid var(--ws-rule)', borderRadius: 8,
              padding: '10px 12px', background: 'var(--ws-bg-2)',
            }}>
              <span style={{
                fontSize: 18, fontWeight: 700, color: 'var(--ws-ink)',
                display: 'block', letterSpacing: '-0.01em',
              }}>
                {c.available}/{c.total}
              </span>
              <div style={{
                fontSize: 11, color: 'var(--ws-ink-mute)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4,
              }}>
                {cat}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
