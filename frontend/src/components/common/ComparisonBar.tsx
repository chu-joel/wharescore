'use client';


interface ComparisonBarProps {
  label: string;
  propertyValue: number;
  suburbAvg: number | null;
  cityAvg: number | null;
  unit?: string;
  /** If true, lower values are better (e.g., crime, noise). If false, higher is better (e.g., schools). */
  lowerIsBetter?: boolean;
  /** Format the value for display */
  formatValue?: (value: number) => string;
  /** Suburb name for contextual sentence (e.g., "Mt Eden") */
  suburbName?: string;
}

function defaultFormat(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1);
}

type Sentiment = 'positive' | 'neutral' | 'negative';

interface ContextInsight {
  sentence: string;
  sentiment: Sentiment;
}

/**
 * Generate a human-readable contextual sentence comparing this property
 * to the suburb average. Returns null if no suburb average is available.
 */
function getContextInsight(
  label: string,
  propertyValue: number,
  suburbAvg: number | null,
  lowerIsBetter: boolean,
  suburbName?: string,
): ContextInsight | null {
  if (suburbAvg === null || suburbAvg <= 0) return null;

  const diff = propertyValue - suburbAvg;
  const absDiff = Math.abs(diff);
  const ratio = propertyValue / suburbAvg;
  const pctDiff = Math.abs(ratio - 1) * 100;
  const area = suburbName || 'the suburb';

  // Within 15% — basically typical
  if (pctDiff < 15) {
    return { sentence: `Typical for ${area}`, sentiment: 'neutral' };
  }

  const isMore = diff > 0;
  const isGood = lowerIsBetter ? !isMore : isMore;
  const sentiment: Sentiment = isGood ? 'positive' : 'negative';

  // Build specific sentences based on metric type
  const lowerLabel = label.toLowerCase();

  if (lowerLabel.includes('school')) {
    const diffCount = Math.round(absDiff);
    if (isMore) {
      return { sentence: `${diffCount} more school${diffCount !== 1 ? 's' : ''} nearby than typical for ${area}`, sentiment };
    }
    return { sentence: `${diffCount} fewer school${diffCount !== 1 ? 's' : ''} nearby than typical for ${area}`, sentiment };
  }

  if (lowerLabel.includes('transit') || lowerLabel.includes('stop')) {
    const diffCount = Math.round(absDiff);
    if (isMore) {
      return { sentence: `${diffCount} more transit stop${diffCount !== 1 ? 's' : ''} than most of ${area}`, sentiment };
    }
    return { sentence: `${diffCount} fewer transit stop${diffCount !== 1 ? 's' : ''} than most of ${area}`, sentiment };
  }

  if (lowerLabel.includes('noise')) {
    const dbDiff = Math.round(absDiff);
    if (isMore) {
      return { sentence: `${dbDiff} dB louder than most of ${area}`, sentiment };
    }
    return { sentence: `${dbDiff} dB quieter than most of ${area}`, sentiment };
  }

  if (lowerLabel.includes('deprivation')) {
    if (ratio >= 1.5) {
      return { sentence: `More deprived than most of ${area}`, sentiment };
    }
    if (ratio <= 0.65) {
      return { sentence: `Less deprived than most of ${area}`, sentiment };
    }
    if (isMore) {
      return { sentence: `Slightly more deprived than ${area} average`, sentiment };
    }
    return { sentence: `Slightly less deprived than ${area} average`, sentiment };
  }

  if (lowerLabel.includes('earthquake') || lowerLabel.includes('epb')) {
    const diffCount = Math.round(absDiff);
    if (propertyValue === 0) {
      return { sentence: `None nearby — better than most of ${area}`, sentiment: 'positive' };
    }
    if (isMore) {
      return { sentence: `${diffCount} more than typical for ${area}`, sentiment };
    }
    return { sentence: `${diffCount} fewer than typical for ${area}`, sentiment };
  }

  // Generic fallback with percentage and an explicit good/concern tag so
  // readers don't have to infer direction from colour alone.
  const pctRound = Math.round(pctDiff);
  const tag = isGood ? 'better' : 'worse';
  if (isMore) {
    const qualifier = lowerIsBetter ? 'higher' : 'more';
    return { sentence: `${pctRound}% ${qualifier} than ${area} average (${tag})`, sentiment };
  }
  const qualifier = lowerIsBetter ? 'lower' : 'less';
  return { sentence: `${pctRound}% ${qualifier} than ${area} average (${tag})`, sentiment };
}

const SENTIMENT_STYLES: Record<Sentiment, string> = {
  positive: 'text-green-600 dark:text-green-400',
  neutral: 'text-muted-foreground',
  negative: 'text-amber-600 dark:text-amber-400',
};

const SENTIMENT_DOT: Record<Sentiment, string> = {
  positive: 'bg-green-500',
  neutral: 'bg-muted-foreground/40',
  negative: 'bg-amber-500',
};

export function ComparisonBar({
  label,
  propertyValue,
  suburbAvg,
  cityAvg,
  unit = '',
  lowerIsBetter = false,
  formatValue = defaultFormat,
  suburbName,
}: ComparisonBarProps) {
  const allValues = [propertyValue, suburbAvg, cityAvg].filter(
    (v): v is number => v !== null && v > 0,
  );
  if (allValues.length === 0) return null;
  const maxValue = Math.max(...allValues) * 1.15;

  const barWidth = (value: number) => `${Math.max(4, (value / maxValue) * 100)}%`;

  const insight = getContextInsight(label, propertyValue, suburbAvg, lowerIsBetter, suburbName);

  return (
    <div className="space-y-1.5">
      {/* Header: label + contextual sentence */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold">{label}</span>
        {insight && (
          <span className={`text-xs font-medium leading-tight text-right flex items-center gap-1 shrink-0 ${SENTIMENT_STYLES[insight.sentiment]}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${SENTIMENT_DOT[insight.sentiment]}`} />
            {insight.sentence}
          </span>
        )}
      </div>

      {/* Property value bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-14 shrink-0">This place</span>
        <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden relative">
          <div
            className="h-full bg-piq-primary rounded-sm transition-all duration-500"
            style={{ width: barWidth(propertyValue) }}
          />
        </div>
        <span className="text-xs font-medium w-14 text-right tabular-nums">
          {formatValue(propertyValue)}{unit}
        </span>
      </div>

      {/* Suburb average bar */}
      {suburbAvg !== null && suburbAvg > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0">Suburb</span>
          <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden relative">
            <div
              className="h-full bg-muted-foreground/25 rounded-sm transition-all duration-500"
              style={{ width: barWidth(suburbAvg) }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-14 text-right tabular-nums">
            {formatValue(suburbAvg)}{unit}
          </span>
        </div>
      )}

      {/* City average bar */}
      {cityAvg !== null && cityAvg > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0">City</span>
          <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden relative">
            <div
              className="h-full bg-muted-foreground/15 rounded-sm transition-all duration-500"
              style={{ width: barWidth(cityAvg) }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-14 text-right tabular-nums">
            {formatValue(cityAvg)}{unit}
          </span>
        </div>
      )}
    </div>
  );
}

interface ComparisonSectionProps {
  comparisons: {
    label: string;
    propertyValue: number;
    suburbAvg: number | null;
    cityAvg: number | null;
    unit?: string;
    lowerIsBetter?: boolean;
    formatValue?: (value: number) => string;
  }[];
  suburbName?: string;
}

export function ComparisonSection({ comparisons, suburbName }: ComparisonSectionProps) {
  const validComparisons = comparisons.filter(c => c.propertyValue > 0);
  if (validComparisons.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-elevated">
      <h3 className="text-sm font-bold mb-1">How this property compares</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Key metrics vs suburb and city averages.
      </p>
      <div className="space-y-5">
        {validComparisons.map((c) => (
          <ComparisonBar key={c.label} {...c} suburbName={suburbName} />
        ))}
      </div>
    </div>
  );
}
