'use client';

import { Snowflake, CloudSnow, Minus, Sun, Flame } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MarketHeatBadgeProps {
  heat: 'cold' | 'cool' | 'neutral' | 'warm' | 'hot';
}

interface HeatConfig {
  label: string;
  color: string;
  bg: string;
  icon: LucideIcon;
}

const HEAT_LEVELS: Array<'cold' | 'cool' | 'neutral' | 'warm' | 'hot'> = [
  'cold',
  'cool',
  'neutral',
  'warm',
  'hot',
];

const HEAT_CONFIG: Record<string, HeatConfig> = {
  cold: { label: 'Cold Market', color: '#3B82F6', bg: 'bg-blue-50 dark:bg-blue-950/30', icon: Snowflake },
  cool: { label: 'Cool Market', color: '#06B6D4', bg: 'bg-cyan-50 dark:bg-cyan-950/30', icon: CloudSnow },
  neutral: { label: 'Neutral Market', color: '#6B7280', bg: 'bg-gray-50 dark:bg-gray-800/30', icon: Minus },
  warm: { label: 'Warm Market', color: '#F59E0B', bg: 'bg-amber-50 dark:bg-amber-950/30', icon: Sun },
  hot: { label: 'Hot Market', color: '#EF4444', bg: 'bg-red-50 dark:bg-red-950/30', icon: Flame },
};

const THERMOMETER_COLORS = ['#3B82F6', '#06B6D4', '#6B7280', '#F59E0B', '#EF4444'];

export function MarketHeatBadge({ heat }: MarketHeatBadgeProps) {
  const config = HEAT_CONFIG[heat];
  if (!config) return null;

  const Icon = config.icon;
  const activeIndex = HEAT_LEVELS.indexOf(heat);

  return (
    <div className={`inline-flex flex-col items-center gap-1.5 rounded-full px-4 py-2 ${config.bg}`}>
      {/* Pill badge with icon + label */}
      <div className="flex items-center gap-1.5">
        <Icon className="h-4 w-4" style={{ color: config.color }} />
        <span className="text-xs font-semibold" style={{ color: config.color }}>
          {config.label}
        </span>
      </div>

      {/* Thermometer: 5 dots */}
      <div className="flex items-center gap-1">
        {HEAT_LEVELS.map((level, i) => {
          const filled = i <= activeIndex;
          return (
            <span
              key={level}
              className="block h-2 w-2 rounded-full"
              style={
                filled
                  ? { backgroundColor: THERMOMETER_COLORS[i] }
                  : { border: `1.5px solid ${THERMOMETER_COLORS[i]}`, backgroundColor: 'transparent' }
              }
            />
          );
        })}
      </div>
    </div>
  );
}
