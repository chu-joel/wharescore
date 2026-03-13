'use client';

import { getRatingColor } from '@/lib/constants';
import { formatScore } from '@/lib/format';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CategoryScore } from '@/lib/types';
import { CATEGORIES } from '@/lib/constants';

interface ScoreStripProps {
  categories: CategoryScore[];
}

export function ScoreStrip({ categories }: ScoreStripProps) {
  return (
      <div className="flex justify-center gap-4">
        {CATEGORIES.map((meta) => {
          const cat = Array.isArray(categories) ? categories.find((c) => c.name === meta.name) : undefined;
          if (!cat) return null;
          const color = getRatingColor(cat.rating);

          return (
            <Tooltip key={meta.name}>
              <TooltipTrigger className="flex flex-col items-center gap-1 cursor-default">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-full text-white text-xs font-bold"
                  style={{ backgroundColor: color }}
                >
                  {formatScore(cat.score)}
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight text-center max-w-[56px]">
                  {meta.label.split(' & ')[0]}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {meta.label}: {formatScore(cat.score)}/100
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
  );
}
