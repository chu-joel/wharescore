'use client';

import { formatCurrency } from '@/lib/format';

interface PriceBandGaugeProps {
  bandLow: number;
  bandHigh: number;
  bandLowOuter: number;
  bandHighOuter: number;
  askingPrice: number | null;
  estimatedValue: number;
}

export function PriceBandGauge({
  bandLow,
  bandHigh,
  bandLowOuter,
  bandHighOuter,
  askingPrice,
  estimatedValue,
}: PriceBandGaugeProps) {
  const outerWidth = bandHighOuter - bandLowOuter || 1;
  const padding = outerWidth * 0.6;
  const min = Math.max(0, bandLowOuter - padding);
  const max = bandHighOuter + padding;
  const range = max - min;

  const toPercent = (val: number) => Math.max(0, Math.min(100, ((val - min) / range) * 100));

  const outerLeftPct = toPercent(bandLowOuter);
  const outerRightPct = toPercent(bandHighOuter);
  const outerWidthPct = outerRightPct - outerLeftPct;
  const innerLeftPct = toPercent(bandLow);
  const innerRightPct = toPercent(bandHigh);
  const innerWidthPct = innerRightPct - innerLeftPct;
  const estimatePct = toPercent(estimatedValue);

  const hasAsking = askingPrice !== null && askingPrice > 0;
  const askingPct = hasAsking ? toPercent(askingPrice) : 0;

  const isAbove = hasAsking && askingPrice > bandHighOuter;
  const isInOuter = hasAsking && !isAbove && askingPrice > bandHigh;
  const isInInner = hasAsking && askingPrice >= bandLow && askingPrice <= bandHigh;
  const isBelow = hasAsking && askingPrice < bandLow;

  const markerColor = isInInner
    ? 'var(--color-piq-success)'
    : isInOuter
      ? 'var(--color-piq-accent-warm)'
      : isAbove
        ? 'var(--color-risk-high)'
        : isBelow
          ? 'var(--color-piq-success)'
          : 'var(--color-piq-primary)';

  const shortCurrency = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    return `$${Math.round(v / 1000)}K`;
  };

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="relative h-7 bg-muted rounded-full overflow-visible">
        {/* Outer band */}
        <div
          className="absolute top-0 bottom-0 bg-piq-primary/6 border-y border-piq-primary/15 rounded-full"
          style={{ left: `${outerLeftPct}%`, width: `${outerWidthPct}%` }}
        />
        {/* Inner band */}
        <div
          className="absolute top-0 bottom-0 bg-piq-primary/20 border-y border-piq-primary/30"
          style={{ left: `${innerLeftPct}%`, width: `${innerWidthPct}%` }}
        />
        {/* Inner band edges */}
        <div className="absolute top-0 bottom-0 w-px bg-piq-primary/40" style={{ left: `${innerLeftPct}%` }} />
        <div className="absolute top-0 bottom-0 w-px bg-piq-primary/40" style={{ left: `${innerRightPct}%` }} />
        {/* Estimate marker (subtle) */}
        <div
          className="absolute top-1 bottom-1 w-px bg-piq-primary/60"
          style={{ left: `${estimatePct}%` }}
        />
        {/* Asking price marker */}
        {hasAsking && (
          <div
            className="absolute w-0.5 rounded-full"
            style={{
              left: `${askingPct}%`,
              top: '-4px',
              bottom: '-4px',
              backgroundColor: markerColor,
            }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-[10px] px-1">
        <span className="text-muted-foreground/60 tabular-nums">{shortCurrency(bandLowOuter)}</span>
        <span className="text-piq-primary font-medium tabular-nums">
          {shortCurrency(bandLow)} – {shortCurrency(bandHigh)}
        </span>
        <span className="text-muted-foreground/60 tabular-nums">{shortCurrency(bandHighOuter)}</span>
      </div>

      {/* Asking price callout */}
      {hasAsking && (
        <div className="text-center">
          <span className="text-xs font-semibold tabular-nums" style={{ color: markerColor }}>
            Asking: {formatCurrency(askingPrice)}
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-sm bg-piq-primary/20 border border-piq-primary/30" />
          Fair range
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-sm bg-piq-primary/6 border border-piq-primary/15" />
          Possible range
        </span>
        {hasAsking && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: markerColor }} />
            Asking price
          </span>
        )}
      </div>
    </div>
  );
}
