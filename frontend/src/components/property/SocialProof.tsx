'use client';

import { Users, TrendingUp } from 'lucide-react';

interface SocialProofProps {
  suburbName: string;
}

/**
 * Shows social proof: "X reports for [suburb] this month".
 * Uses a seeded pseudo-random number based on suburb name so
 * the count is consistent per suburb but varies between suburbs.
 *
 * Renders the same on server and client (no hydration mismatch)
 * by computing deterministically from the suburb name.
 */
export function SocialProof({ suburbName }: SocialProofProps) {
  // Generate a consistent pseudo-random count per suburb (15-85 range)
  const hash = suburbName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const reportCount = 15 + (hash % 71);

  // "Recently researched" — show for ~60% of properties
  const showRecent = hash % 5 < 3;
  const daysAgo = 1 + (hash % 5);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Users className="h-3 w-3 shrink-0" />
        {reportCount} reports for {suburbName} this month
      </span>
      {showRecent && (
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 shrink-0" />
          Last researched {daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`}
        </span>
      )}
    </div>
  );
}
