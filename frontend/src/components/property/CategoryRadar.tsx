'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { CATEGORIES } from '@/lib/constants';
import type { CategoryScore } from '@/lib/types';

interface CategoryRadarProps {
  categories: CategoryScore[];
}

const SHORT_LABELS: Record<string, string> = {
  risk: 'Risk',
  liveability: 'Neighbourhood',
  market: 'Market',
  transport: 'Transport',
  planning: 'Planning',
};

export function CategoryRadar({ categories }: CategoryRadarProps) {
  if (categories.length < 3) return null;

  // Build radar data in CATEGORIES order, only include categories that have data
  const data = CATEGORIES
    .map((cat) => {
      const match = categories.find((c) => c.name === cat.name);
      if (!match) return null;
      return {
        name: SHORT_LABELS[cat.name] ?? cat.name,
        score: Math.round(match.score),
        fullMark: 100,
      };
    })
    .filter(Boolean) as { name: string; score: number; fullMark: number }[];

  if (data.length < 3) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <p className="text-sm font-bold">Property Profile</p>
      <p className="text-xs text-muted-foreground mb-2">
        Lower is better — higher scores indicate more risk
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6B7280' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { name: string; score: number };
              const riskLevel = d.score <= 20 ? 'Very Low Risk' : d.score <= 40 ? 'Low Risk' : d.score <= 60 ? 'Moderate Risk' : d.score <= 80 ? 'High Risk' : 'Very High Risk';
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm">
                  {d.name}: <span className="font-semibold">{d.score}/100</span>
                  <span className="text-xs text-muted-foreground ml-1">({riskLevel})</span>
                </div>
              );
            }}
          />
          <Radar
            dataKey="score"
            stroke="#0D7377"
            fill="#0D7377"
            fillOpacity={0.15}
            strokeWidth={2}
            animationDuration={1200}
            dot={{ r: 4, fill: '#0D7377', stroke: 'white', strokeWidth: 2 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
