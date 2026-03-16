'use client';

import { useEffect, useRef, useState } from 'react';
import { getRatingBin } from '@/lib/constants';
import { formatScore } from '@/lib/format';

interface ScoreGaugeProps {
  score: number;
  label: string;
  color: string;
  percentileText?: string;
  animated?: boolean;
}

const RADIUS = 80;
const STROKE_WIDTH = 14;
const CENTER = 100;
const TOTAL_DEGREES = 240;
const START_ANGLE = 150; // start from bottom-left
const OUTER_RING_RADIUS = RADIUS + 18;

function polarToCartesian(angle: number, radius: number = RADIUS) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

function describeArc(startAngle: number, sweepDegrees: number, radius: number = RADIUS) {
  const start = polarToCartesian(startAngle, radius);
  const end = polarToCartesian(startAngle + sweepDegrees, radius);
  const largeArc = sweepDegrees > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function ScoreGauge({ score, label, color, percentileText, animated = true }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const [arcProgress, setArcProgress] = useState(animated ? 0 : 1);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const duration = 1000;

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!animated || prefersReducedMotion) {
      setDisplayScore(score);
      setArcProgress(1);
      return;
    }

    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      setDisplayScore(Math.round(eased * score));
      setArcProgress(eased);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [score, animated, prefersReducedMotion]);

  const sweepDegrees = TOTAL_DEGREES * (score / 100) * arcProgress;
  const bgPath = describeArc(START_ANGLE, TOTAL_DEGREES);
  const scorePath = sweepDegrees > 0 ? describeArc(START_ANGLE, sweepDegrees) : '';
  const outerRingPath = describeArc(START_ANGLE, TOTAL_DEGREES, OUTER_RING_RADIUS);

  // Display label: "Moderate" → "Moderate Risk"
  const displayLabel = label.includes('Risk') ? label : `${label} Risk`;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-36 h-36" role="img" aria-label={`Score: ${score} out of 100, ${displayLabel}`}>
        <defs>
          <filter id="scoreGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Decorative outer ring */}
        <path
          d={outerRingPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="4 8"
          strokeLinecap="round"
          className="text-border"
        />
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          className="text-muted/20"
          opacity={0.15}
        />
        {/* Glow layer */}
        {scorePath && (
          <path
            d={scorePath}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH + 4}
            strokeLinecap="round"
            opacity={0.15}
          />
        )}
        {/* Score arc */}
        {scorePath && (
          <path
            d={scorePath}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />
        )}
        {/* Score number */}
        <text
          x={CENTER}
          y={CENTER - 8}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: 46, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
          fill={color}
        >
          {formatScore(displayScore)}
        </text>
        {/* Label */}
        <text
          x={CENTER}
          y={CENTER + 24}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {displayLabel}
        </text>
      </svg>
      {percentileText && (
        <p className="text-xs text-muted-foreground mt-1">{percentileText}</p>
      )}
    </div>
  );
}
