'use client';

import { formatRent } from '@/lib/format';

interface RentBandGaugeProps {
  bandLow: number;
  bandHigh: number;
  bandLowOuter: number;
  bandHighOuter: number;
  userRent: number;
  rawMedian: number;
}

export function RentBandGauge({
  bandLow,
  bandHigh,
  bandLowOuter,
  bandHighOuter,
  userRent,
  rawMedian,
}: RentBandGaugeProps) {
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
  const userPct = toPercent(userRent);
  const medianPct = toPercent(rawMedian);

  const isAbove = userRent > bandHighOuter;
  const isInOuter = !isAbove && userRent > bandHigh;
  const isInInner = userRent >= bandLow && userRent <= bandHigh;

  const markerColor = isInInner
    ? 'var(--color-piq-success)'
    : isInOuter
      ? 'var(--color-piq-accent-warm)'
      : isAbove
        ? 'var(--color-risk-high)'
        : 'var(--color-piq-success)';

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="relative h-7 bg-muted rounded-full overflow-visible">
        {/* Outer band (±3% deviation) */}
        <div
          className="absolute top-0 bottom-0 bg-piq-primary/6 border-y border-piq-primary/15 rounded-full"
          style={{ left: `${outerLeftPct}%`, width: `${outerWidthPct}%` }}
        />
        {/* Inner band (calculated fair range) */}
        <div
          className="absolute top-0 bottom-0 bg-piq-primary/20 border-y border-piq-primary/30"
          style={{ left: `${innerLeftPct}%`, width: `${innerWidthPct}%` }}
        />
        {/* Inner band edges */}
        <div
          className="absolute top-0 bottom-0 w-px bg-piq-primary/40"
          style={{ left: `${innerLeftPct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-piq-primary/40"
          style={{ left: `${innerRightPct}%` }}
        />
        {/* Median marker (subtle) */}
        <div
          className="absolute top-1 bottom-1 w-px bg-piq-primary/60"
          style={{ left: `${medianPct}%` }}
        />
        {/* User rent marker — only show when user has entered a rent */}
        {userRent > 0 && (
          <div
            className="absolute w-0.5 rounded-full"
            style={{
              left: `${userPct}%`,
              top: '-4px',
              bottom: '-4px',
              backgroundColor: markerColor,
            }}
          />
        )}
      </div>

      {/* Labels — only inner band edges + user rent, positioned above/below to avoid overlap */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-muted-foreground/60 tabular-nums">{formatRent(bandLowOuter)}</span>
        <span className="text-piq-primary font-medium tabular-nums">
          {formatRent(bandLow)} – {formatRent(bandHigh)}
        </span>
        <span className="text-muted-foreground/60 tabular-nums">{formatRent(bandHighOuter)}</span>
      </div>

      {/* User rent callout */}
      <div className="text-center">
        {userRent > 0 ? (
          <span className="text-xs font-semibold tabular-nums" style={{ color: markerColor }}>
            Your rent: {formatRent(userRent)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">
            Enter your rent to compare
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-sm bg-piq-primary/20 border border-piq-primary/30" />
          Fair range
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-sm bg-piq-primary/6 border border-piq-primary/15" />
          Possible range
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: markerColor }} />
          Your rent
        </span>
      </div>
    </div>
  );
}
