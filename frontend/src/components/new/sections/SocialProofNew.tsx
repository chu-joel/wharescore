'use client';

import { Users, TrendingUp } from 'lucide-react';

/**
 * Social proof line — "X reports for {suburb} this month".
 * Same deterministic seeded counts as classic so SSR hydrates cleanly.
 */
export function SocialProofNew({ suburbName }: { suburbName: string }) {
  if (!suburbName) return null;
  const hash = suburbName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const reportCount = 15 + (hash % 71);
  const showRecent = hash % 5 < 3;
  const daysAgo = 1 + (hash % 5);

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap',
      gap: '12px',
      fontSize: 11.5, color: 'var(--ws-ink-mute)',
      fontWeight: 500,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Users size={12} />
        {reportCount} reports for {suburbName} this month
      </span>
      {showRecent && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <TrendingUp size={12} />
          Last researched {daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`}
        </span>
      )}
    </div>
  );
}
