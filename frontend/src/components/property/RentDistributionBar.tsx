'use client';

import { AlertTriangle } from 'lucide-react';
import { formatRent } from '@/lib/format';

interface RentDistributionBarProps {
  lowerQuartile: number;
  median: number;
  upperQuartile: number;
  userRent?: number;
  confidence: 1 | 2 | 3 | 4 | 5;
  userPercentile?: number | null;
  bondCount?: number;
}

export function RentDistributionBar({
  lowerQuartile,
  median,
  upperQuartile,
  userRent,
  confidence,
  userPercentile,
  bondCount,
}: RentDistributionBarProps) {
  // Scale: bar spans from LQ - 10% to UQ + 10%
  const padding = (upperQuartile - lowerQuartile) * 0.1;
  const min = lowerQuartile - padding;
  const max = upperQuartile + padding;
  const range = max - min;

  const toPercent = (val: number) => Math.max(0, Math.min(100, ((val - min) / range) * 100));

  const lqPos = toPercent(lowerQuartile);
  const medPos = toPercent(median);
  const uqPos = toPercent(upperQuartile);
  const userPos = userRent ? toPercent(userRent) : null;

  return (
    <div className="space-y-1">
      {/* Bar */}
      <div className="relative h-6 bg-muted rounded-full overflow-hidden">
        {/* LQ-Med range */}
        <div
          className="absolute top-0 bottom-0 bg-piq-primary/20"
          style={{ left: `${lqPos}%`, width: `${medPos - lqPos}%` }}
        />
        {/* Med-UQ range */}
        <div
          className="absolute top-0 bottom-0 bg-piq-primary/10"
          style={{ left: `${medPos}%`, width: `${uqPos - medPos}%` }}
        />
        {/* Median marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-piq-primary"
          style={{ left: `${medPos}%` }}
        />
        {/* User rent marker */}
        {userPos !== null && (
          <div
            className="absolute w-1 bg-piq-accent-warm"
            style={{ left: `${userPos}%`, top: '-4px', bottom: '-4px' }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatRent(lowerQuartile)}</span>
        <span className="text-xs font-semibold text-foreground">{formatRent(median)}</span>
        <span>{formatRent(upperQuartile)}</span>
      </div>

      {/* User rent info */}
      {userRent && (
        <div className="text-xs text-center">
          <span className="text-piq-accent-warm font-medium">
            Your rent: {formatRent(userRent)}
          </span>
          {userPercentile !== null && userPercentile !== undefined && (
            <span className="text-muted-foreground ml-1.5">
              ({Math.round(userPercentile)}th percentile)
            </span>
          )}
        </div>
      )}

      {/* Low confidence warning */}
      {confidence <= 2 && (
        <div className="flex items-center gap-1 text-xs text-piq-accent-warm">
          <AlertTriangle className="h-3 w-3" />
          <span>
            {bondCount
              ? `Based on ${bondCount} bond${bondCount !== 1 ? 's' : ''} in this area`
              : `Limited sample. ${confidence === 1 ? 'very few' : 'few'} bonds in this area`}
          </span>
        </div>
      )}
    </div>
  );
}
