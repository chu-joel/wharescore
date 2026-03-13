'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getRatingColor } from '@/lib/constants';
import type { IndicatorScore } from '@/lib/types';

interface IndicatorCardProps {
  indicator: IndicatorScore;
}

function badgeVariant(rating: string) {
  if (rating === 'very-low' || rating === 'low') return 'default' as const;
  if (rating === 'moderate') return 'secondary' as const;
  return 'destructive' as const;
}

export function IndicatorCard({ indicator }: IndicatorCardProps) {
  const color = getRatingColor(indicator.rating);

  if (!indicator.is_available) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 opacity-60">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{indicator.name}</span>
          <Badge variant="outline" className="text-xs">No data</Badge>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{indicator.name}</span>
          <Badge variant={badgeVariant(indicator.rating)} className="text-xs shrink-0">
            {indicator.value}
          </Badge>
        </div>
        {/* Score bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${indicator.score}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">
            {Math.round(indicator.score)}
          </span>
        </div>
        {/* Source */}
        <Tooltip>
          <TooltipTrigger
            className="text-[10px] text-muted-foreground mt-1.5 cursor-default block text-left"
          >
            {indicator.source}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Updated: {indicator.updated}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
