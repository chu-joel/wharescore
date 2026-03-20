'use client';

import { formatCurrency } from '@/lib/format';

export interface BudgetSegment {
  label: string;
  amount: number;
  color: string;
}

interface BudgetBreakdownChartProps {
  segments: BudgetSegment[];
  total: number;
}

export function BudgetBreakdownChart({ segments, total }: BudgetBreakdownChartProps) {
  if (total <= 0) return null;

  return (
    <div className="space-y-2">
      {/* Stacked horizontal bar */}
      <div className="flex h-4 rounded-full overflow-hidden bg-muted/40">
        {segments.map((seg) => {
          const pct = (seg.amount / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={seg.label}
              className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${formatCurrency(Math.round(seg.amount))}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-medium tabular-nums">{formatCurrency(Math.round(seg.amount))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
