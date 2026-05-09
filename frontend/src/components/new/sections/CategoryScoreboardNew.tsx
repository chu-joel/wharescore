'use client';

import type { PropertyReport } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

/**
 * 6-category scoreboard. Reads scores.categories (CategoryScore[]) from the
 * transformed report. Each row gets a coloured mini-bar.
 */
export function CategoryScoreboardNew({ report }: { report: PropertyReport }) {
  const cats = report.scores?.categories ?? [];
  if (cats.length === 0) return null;

  const cov = report.coverage;
  return (
    <Card>
      <CardHead title="Score by category" meta={cov ? `${cov.percentage}% confidence` : undefined} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--ws-rule)' }}>
        {cats.map((c) => (
          <div key={c.name} style={{ background: 'var(--ws-surface)', padding: '14px 16px' }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--ws-ink-mute)', marginBottom: 4,
            }}>
              {capitalize(c.name)}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ws-ink)', letterSpacing: '-0.01em' }}>
              {c.score.toFixed(1)}
              <small style={{ fontSize: 11, fontWeight: 500, color: 'var(--ws-ink-soft)', marginLeft: 4 }}>/100</small>
            </div>
            <div style={{ marginTop: 8, height: 3, background: 'var(--ws-rule)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, c.score)}%`, background: barColorFor(c.score) }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function barColorFor(v: number): string {
  if (v >= 75) return 'var(--ws-success)';
  if (v >= 55) return 'var(--ws-r-mod)';
  if (v >= 35) return 'var(--ws-r-high)';
  return 'var(--ws-r-vhigh)';
}
