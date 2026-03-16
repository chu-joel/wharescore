'use client';

interface CoverageRingProps {
  available: number;
  total: number;
  percentage: number;
}

export function CoverageRing({ available, total, percentage }: CoverageRingProps) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const filled = (percentage / 100) * circumference;
  const gap = circumference - filled;

  return (
    <div className="flex items-center justify-center gap-2">
      <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
        {/* Background ring */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeWidth={3}
        />
        {/* Filled ring */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#0D7377"
          strokeWidth={3}
          strokeDasharray={`${filled} ${gap}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
        {/* Percentage text */}
        <text
          x="18"
          y="18"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="9"
          fontWeight="600"
          fill="currentColor"
          className="text-foreground"
        >
          {Math.round(percentage)}%
        </text>
      </svg>
      <span className="text-xs text-muted-foreground">
        {available} of {total} indicators
      </span>
    </div>
  );
}
