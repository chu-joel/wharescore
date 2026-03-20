'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Direction = 'improving' | 'worsening' | 'stable';

interface TrendIndicatorProps {
  direction: Direction;
  label?: string;
}

const CONFIG: Record<Direction, { Icon: typeof TrendingUp; color: string; defaultLabel: string }> = {
  improving: { Icon: TrendingDown, color: 'text-green-600 dark:text-green-400', defaultLabel: 'Improving' },
  worsening: { Icon: TrendingUp, color: 'text-red-600 dark:text-red-400', defaultLabel: 'Worsening' },
  stable: { Icon: Minus, color: 'text-gray-500 dark:text-gray-400', defaultLabel: 'Stable' },
};

export function TrendIndicator({ direction, label }: TrendIndicatorProps) {
  const cfg = CONFIG[direction];
  const Icon = cfg.Icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {label ?? cfg.defaultLabel}
    </span>
  );
}
