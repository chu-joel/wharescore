'use client';

import { Volume2, Plane } from 'lucide-react';
import { ContextBadge } from '@/components/common/ContextBadge';

interface NoiseLevelGaugeProps {
  noiseDb: number | null;
  aircraftNoiseName?: string | null;
  aircraftNoiseDba?: number | null;
  aircraftNoiseCategory?: string | null;
}

/**
 * Approximate percentile from Wellington noise distribution.
 * Based on NZTA data: median ~55dB, most properties 40-75dB range.
 */
function getNoisePercentile(db: number): number {
  if (db <= 40) return 5;
  if (db <= 45) return 15;
  if (db <= 50) return 30;
  if (db <= 55) return 50;
  if (db <= 60) return 65;
  if (db <= 65) return 80;
  if (db <= 70) return 90;
  return 95;
}

function getZone(db: number) {
  if (db < 45) return { label: 'Quiet', color: 'text-piq-success', context: 'Comparable to a library or quiet park' };
  if (db < 55) return { label: 'Moderate', color: 'text-teal-500', context: 'Normal conversation level' };
  if (db < 65) return { label: 'Noticeable', color: 'text-amber-500', context: 'Similar to a busy road during the day' };
  if (db < 75) return { label: 'Loud', color: 'text-orange-500', context: 'Comparable to a busy restaurant. Consider acoustic glazing' };
  return { label: 'Very Loud', color: 'text-red-500', context: 'Very loud. similar to a vacuum cleaner at close range' };
}

export function NoiseLevelGauge({ noiseDb, aircraftNoiseName, aircraftNoiseDba, aircraftNoiseCategory }: NoiseLevelGaugeProps) {
  if (noiseDb === null && !aircraftNoiseName) return null;

  const db = noiseDb ?? 0;
  const zone = getZone(db);
  const pct = Math.max(0, Math.min(100, ((db - 30) / 50) * 100));

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      {/* Title */}
      <div className="flex items-center gap-2 mb-3">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Road Noise Level</span>
      </div>

      {/* Large dB number */}
      <div className="flex items-baseline gap-1 mb-3">
        <span className={`text-2xl font-bold tabular-nums ${zone.color}`}>
          {Math.round(db)}
        </span>
        <span className={`text-sm font-medium ${zone.color}`}>dB</span>
        <span className="ml-2 text-xs text-muted-foreground">{zone.label}</span>
      </div>

      {/* Visual meter */}
      <div className="relative mb-1.5">
        {/* Zone bars */}
        <div className="flex h-3 rounded-full overflow-hidden gap-px">
          <div className="flex-[15] bg-emerald-400/80 rounded-l-full" /> {/* 30-45: Quiet */}
          <div className="flex-[10] bg-teal-400/80" />                    {/* 45-55: Moderate */}
          <div className="flex-[10] bg-amber-400/80" />                   {/* 55-65: Noticeable */}
          <div className="flex-[10] bg-orange-400/80" />                  {/* 65-75: Loud */}
          <div className="flex-[5] bg-red-400/80 rounded-r-full" />       {/* 75-80: Very Loud */}
        </div>

        {/* Triangle marker */}
        <div
          className="absolute -top-1.5 -translate-x-1/2"
          style={{ left: `${pct}%` }}
        >
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-foreground" />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mb-3">
        <span className="text-xs text-muted-foreground">Quiet</span>
        <span className="text-xs text-muted-foreground">Very Loud</span>
      </div>

      {/* Context badge + line */}
      <div className="flex items-center gap-2 mb-1">
        <ContextBadge
          text={`${db <= 55 ? 'Quieter' : 'Louder'} than ${db <= 55 ? 100 - getNoisePercentile(db) : getNoisePercentile(db)}% of properties`}
          sentiment={db < 55 ? 'positive' : db < 65 ? 'neutral' : 'negative'}
        />
      </div>
      <p className="text-xs text-muted-foreground">{zone.context}</p>

      {/* Aircraft noise overlay. show prominently when present */}
      {aircraftNoiseName && (
        <div className={`mt-3 pt-3 border-t border-border flex items-start gap-2.5 ${(aircraftNoiseDba ?? 0) >= 65 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
          <Plane className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">
              Aircraft noise zone{aircraftNoiseDba ? `: ${aircraftNoiseDba} dBA` : ''}
            </p>
            <p className="text-xs mt-0.5">
              {aircraftNoiseCategory ? `${aircraftNoiseCategory}. ` : ''}
              {(aircraftNoiseDba ?? 0) >= 65
                ? 'Significant aircraft noise. Check during peak flight times. Double glazing recommended.'
                : 'Within an airport noise overlay. Visit at different times to assess impact.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
