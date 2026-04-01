'use client';

interface AffordabilityGaugeProps {
  ratio: number; // percentage, e.g. 30 means 30%
}

function getGaugeColor(ratio: number): string {
  if (ratio < 30) return '#22C55E'; // green
  if (ratio <= 40) return '#F59E0B'; // amber
  return '#EF4444'; // red
}

function getGaugeLabel(ratio: number): string {
  if (ratio < 25) return 'Comfortable';
  if (ratio < 30) return 'OK';
  if (ratio <= 35) return 'Stretch';
  if (ratio <= 40) return 'Tight';
  return 'Stressed';
}

export function AffordabilityGauge({ ratio }: AffordabilityGaugeProps) {
  const color = getGaugeColor(ratio);
  const label = getGaugeLabel(ratio);
  // Clamp fill between 0–100
  const fill = Math.min(100, Math.max(0, ratio));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Cost-to-income</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {Math.round(ratio)}% — {label}
        </span>
      </div>

      {/* Bar gauge */}
      <div className="relative h-3 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${fill}%`, backgroundColor: color }}
        />
        {/* 30% and 40% markers */}
        <div className="absolute top-0 bottom-0 left-[30%] w-px bg-foreground/20" />
        <div className="absolute top-0 bottom-0 left-[40%] w-px bg-foreground/20" />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0%</span>
        <span>30%</span>
        <span>40%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
