'use client';

import { AlertTriangle, Shield } from 'lucide-react';
import type { CategoryScore } from '@/lib/types';

interface ScoreStripProps {
  categories: CategoryScore[];
}

const CATEGORY_LABELS: Record<string, string> = {
  risk: 'Hazard risk',
  liveability: 'Neighbourhood',
  market: 'Market',
  transport: 'Transport',
  planning: 'Planning',
};

/** Generates a one-line plain-English summary for a category */
function categoryInsight(cat: CategoryScore): string {
  const n = cat.name;
  const s = cat.score;
  const isGood = s <= 40;
  const isBad = s >= 60;

  if (n === 'risk') {
    if (isBad) return s >= 80 ? 'Significant hazard risks identified' : 'Some hazard risks to investigate';
    if (isGood) return 'No major hazard concerns';
    return 'Moderate hazard exposure';
  }
  if (n === 'liveability') {
    if (isBad) return 'Area has some liveability concerns';
    if (isGood) return 'Good neighbourhood for daily life';
    return 'Average neighbourhood';
  }
  if (n === 'market') {
    if (isBad) return 'Rental market may be unfavourable';
    if (isGood) return 'Healthy rental market';
    return 'Typical market conditions';
  }
  if (n === 'transport') {
    if (isBad) return 'Limited public transport access';
    if (isGood) return 'Well-connected by public transport';
    return 'Some transport options available';
  }
  if (n === 'planning') {
    if (isBad) return 'Development activity may affect area';
    if (isGood) return 'Stable planning environment';
    return 'Moderate planning activity';
  }
  return '';
}

export function ScoreStrip({ categories }: ScoreStripProps) {
  if (!categories || categories.length === 0) return null;

  // Sort to find top concerns (highest score = worst) and strengths (lowest = best)
  const sorted = [...categories].sort((a, b) => a.score - b.score);
  const strengths = sorted.filter(c => c.score <= 40).slice(0, 2);
  const concerns = sorted.filter(c => c.score >= 50).sort((a, b) => b.score - a.score).slice(0, 2);

  // If we don't have clear strengths/concerns, show top/bottom
  const items: { cat: CategoryScore; type: 'strength' | 'concern' | 'neutral' }[] = [];
  if (concerns.length === 0 && strengths.length === 0) {
    // All moderate — show top 2 best and worst
    items.push({ cat: sorted[0], type: 'strength' });
    items.push({ cat: sorted[sorted.length - 1], type: 'concern' });
  } else {
    concerns.forEach(c => items.push({ cat: c, type: 'concern' }));
    strengths.forEach(c => items.push({ cat: c, type: 'strength' }));
  }

  // Show concerns first, then strengths
  const ordered = items.sort((a, b) => {
    if (a.type === 'concern' && b.type !== 'concern') return -1;
    if (a.type !== 'concern' && b.type === 'concern') return 1;
    return 0;
  });

  return (
    <div className="space-y-1.5">
      {ordered.map(({ cat, type }) => {
        const isConcern = type === 'concern';
        const insight = categoryInsight(cat);
        return (
          <div
            key={cat.name}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
              isConcern
                ? 'bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40'
                : 'bg-green-50 dark:bg-green-950/20 border border-green-200/60 dark:border-green-900/40'
            }`}
          >
            {isConcern ? (
              <AlertTriangle className="h-4 w-4 text-risk-high shrink-0" />
            ) : (
              <Shield className="h-4 w-4 text-piq-success shrink-0" />
            )}
            <span className="font-medium">
              {CATEGORY_LABELS[cat.name] ?? cat.name}
            </span>
            <span className="text-muted-foreground text-xs flex-1 truncate">
              {insight}
            </span>
          </div>
        );
      })}
    </div>
  );
}
