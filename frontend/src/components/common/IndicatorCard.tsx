'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getRatingColor } from '@/lib/constants';
import { Shield, CircleMinus, AlertTriangle } from 'lucide-react';
import type { IndicatorScore } from '@/lib/types';

interface IndicatorCardProps {
  indicator: IndicatorScore;
}

function badgeVariant(rating: string) {
  if (rating === 'very-low' || rating === 'low') return 'default' as const;
  if (rating === 'moderate') return 'secondary' as const;
  return 'destructive' as const;
}

function RiskIcon({ rating }: { rating: string }) {
  if (rating === 'very-low' || rating === 'low') {
    return <Shield className="w-3.5 h-3.5 text-risk-very-low shrink-0" />;
  }
  if (rating === 'moderate') {
    return <CircleMinus className="w-3.5 h-3.5 text-risk-moderate shrink-0" />;
  }
  return <AlertTriangle className="w-3.5 h-3.5 text-risk-very-high shrink-0" />;
}

export function IndicatorCard({ indicator }: IndicatorCardProps) {
  const color = getRatingColor(indicator.rating);

  if (!indicator.is_available) {
    return (
      <div className="rounded-xl border border-dashed border-border p-3.5 opacity-50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{indicator.name}</span>
          <Badge variant="outline" className="text-[10px]">No data</Badge>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <RiskIcon rating={indicator.rating} />
            <span className="text-sm font-semibold">{indicator.name}</span>
          </div>
          <Badge variant={badgeVariant(indicator.rating)} className="text-[10px] shrink-0">
            {indicator.value}
          </Badge>
        </div>
        {/* Score bar */}
        <div className="mt-2.5 flex items-center gap-2.5">
          <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out relative"
              style={{
                width: `${indicator.score}%`,
                background: `linear-gradient(90deg, #0D7377, ${color})`,
              }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white shadow-sm" />
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums w-6 text-right">
            {Math.round(indicator.score)}
          </span>
        </div>
        {/* Source */}
        {indicator.source && (
          <Tooltip>
            <TooltipTrigger
              className="text-[10px] text-muted-foreground/70 mt-2 cursor-default block text-left"
            >
              {indicator.source}
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Updated: {indicator.updated || 'Recently'}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
