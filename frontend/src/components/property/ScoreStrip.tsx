'use client';

import { getRatingColor } from '@/lib/constants';
import { formatScore } from '@/lib/format';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CategoryScore } from '@/lib/types';
import { CATEGORIES } from '@/lib/constants';

interface ScoreStripProps {
  categories: CategoryScore[];
}

const SHORT_LABELS: Record<string, string> = {
  risk: 'Risk',
  liveability: 'Area',
  market: 'Market',
  transport: 'Transit',
  planning: 'Planning',
};

export function ScoreStrip({ categories }: ScoreStripProps) {
  return (
    <div className="relative flex justify-center gap-4 sm:gap-5">
      {/* Connecting line behind circles */}
      <div className="absolute left-[22px] right-[22px] top-[22px] h-[2px] bg-border z-0" />
      {CATEGORIES.map((meta) => {
        const cat = Array.isArray(categories) ? categories.find((c) => c.name === meta.name) : undefined;
        const hasData = !!cat;
        const color = hasData ? getRatingColor(cat.rating) : '#9CA3AF';
        const score = hasData ? formatScore(cat.score) : 'N/A';

        return (
          <Tooltip key={meta.name}>
            <TooltipTrigger className="flex flex-col items-center gap-1.5 cursor-default group z-10">
              <div
                className={`relative flex items-center justify-center w-11 h-11 rounded-full text-white text-sm font-bold transition-all duration-200 ring-2 ring-white dark:ring-gray-900 shadow-md group-hover:scale-110 group-hover:ring-4 ${!hasData ? 'opacity-50' : ''}`}
                style={{
                  backgroundColor: color,
                  '--tw-ring-color': undefined,
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  (e.currentTarget.style as any).setProperty('--tw-ring-color', `${color}40`);
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget.style as any).setProperty('--tw-ring-color', '');
                }}
              >
                <span className={!hasData ? 'text-xs' : ''}>{score}</span>
              </div>
              <span className="text-[10px] text-muted-foreground leading-tight text-center max-w-[60px] font-medium">
                {SHORT_LABELS[meta.name] ?? meta.label.split(' & ')[0]}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-medium">
                {meta.label}: {hasData ? `${score}/100` : 'No data available'}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
