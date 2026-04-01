'use client';

import { Footprints } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface WalkabilityScoreProps {
  report: PropertyReport;
}

interface Factor {
  label: string;
  score: number;
  available: boolean;
}

function computeWalkability(report: PropertyReport): { total: number; factors: Factor[] } {
  const l = report.liveability;
  const factors: Factor[] = [];

  // Amenities within 500m (weight: 25)
  const amenityCount = l.amenity_count ?? 0;
  const amenityScore = Math.min(25, Math.round((amenityCount / 15) * 25));
  factors.push({ label: 'Nearby amenities', score: amenityScore, available: l.amenity_count != null });

  // Transit stops within 400m (weight: 25)
  const transitCount = l.transit_count ?? 0;
  const transitScore = Math.min(25, Math.round((transitCount / 10) * 25));
  factors.push({ label: 'Transit access', score: transitScore, available: l.transit_count != null });

  // CBD distance (weight: 20) — closer = higher
  const cbdDist = l.cbd_distance_m ?? 10000;
  const cbdScore = Math.max(0, Math.round(20 * (1 - Math.min(cbdDist, 5000) / 5000)));
  factors.push({ label: 'CBD proximity', score: cbdScore, available: l.cbd_distance_m != null });

  // Schools nearby (weight: 15)
  const schoolCount = l.school_count ?? 0;
  const schoolScore = Math.min(15, Math.round((schoolCount / 5) * 15));
  factors.push({ label: 'Schools', score: schoolScore, available: l.school_count != null });

  // Inverse of noise (weight: 15) — quieter = more walkable
  const noiseDb = report.environment.noise_db ?? 50;
  const noiseScore = Math.max(0, Math.round(15 * (1 - Math.max(0, noiseDb - 40) / 40)));
  factors.push({ label: 'Quiet streets', score: noiseScore, available: report.environment.noise_db != null });

  const total = factors.reduce((s, f) => s + f.score, 0);
  return { total: Math.min(100, total), factors };
}

function getLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: 'Walker\'s Paradise', color: 'text-green-600 dark:text-green-400' };
  if (score >= 60) return { text: 'Very Walkable', color: 'text-teal-600 dark:text-teal-400' };
  if (score >= 40) return { text: 'Somewhat Walkable', color: 'text-amber-600 dark:text-amber-400' };
  if (score >= 20) return { text: 'Car-Dependent', color: 'text-orange-600 dark:text-orange-400' };
  return { text: 'Almost All Errands Require a Car', color: 'text-red-600 dark:text-red-400' };
}

export function WalkabilityScore({ report }: WalkabilityScoreProps) {
  const { total, factors } = computeWalkability(report);
  const label = getLabel(total);

  // SVG circular gauge
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - total / 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2 mb-3">
        <Footprints className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-bold">Walkability Score</span>
      </div>

      <div className="flex items-center gap-5">
        {/* Circular gauge */}
        <div className="relative shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r={radius}
              fill="none" stroke="var(--border)" strokeWidth="8"
            />
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="#0D7377"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{total}</span>
            <span className="text-[9px] text-muted-foreground">/100</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold mb-2 ${label.color}`}>{label.text}</p>
          <div className="flex flex-wrap gap-1.5">
            {factors.filter(f => f.available).map((f) => (
              <span
                key={f.label}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/60 text-xs font-medium"
              >
                {f.label}: {f.score}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
