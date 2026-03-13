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
const STROKE_WIDTH = 12;
const CENTER = 100;
const TOTAL_DEGREES = 240;
const START_ANGLE = 150; // start from bottom-left
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_LENGTH = (TOTAL_DEGREES / 360) * CIRCUMFERENCE;

function polarToCartesian(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(rad),
    y: CENTER + RADIUS * Math.sin(rad),
  };
}

function describeArc(startAngle: number, sweepDegrees: number) {
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(startAngle + sweepDegrees);
  const largeArc = sweepDegrees > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
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
      // cubic-bezier approximation for ease-out
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

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-36 h-36" role="img" aria-label={`Score: ${score} out of 100, ${label}`}>
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          className="text-border dark:text-border-dark"
        />
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
          y={CENTER - 4}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground"
          style={{ fontSize: 48, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {formatScore(displayScore)}
        </text>
        {/* Label */}
        <text
          x={CENTER}
          y={CENTER + 28}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground"
          style={{ fontSize: 14 }}
        >
          {label}
        </text>
      </svg>
      {percentileText && (
        <p className="text-xs text-muted-foreground mt-1">{percentileText}</p>
      )}
    </div>
  );
}
