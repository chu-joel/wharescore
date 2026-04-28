'use client';

import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type CompareValue,
  type DiffStrategy,
  type ColumnLabel,
  diffSentence,
  isIdentical,
  winnerOf,
} from '@/lib/compareDiff';

const COLUMN_CHIP_ACCENT = [
  'border-piq-primary',           // A — teal
  'border-piq-accent-warm',       // B — amber
  'border-piq-primary-dark',      // C — deep teal
];
const COLUMN_TEXT_ACCENT = [
  'text-piq-primary',
  'text-piq-accent-warm',
  'text-piq-primary-dark',
];
const COLUMN_BG_TINT = [
  'bg-piq-primary/5',
  'bg-piq-accent-warm/5',
  'bg-piq-primary-dark/5',
];

export interface CompareRowProps {
  label: string;
  values: CompareValue[];
  columns: ColumnLabel[];
  strategy: DiffStrategy;
  formatDelta?: (winner: CompareValue, loser: CompareValue) => string;
}

function ValueChip({
  value,
  isWinner,
  columnIdx,
  columnLetter,
}: {
  value: CompareValue;
  isWinner: boolean;
  columnIdx: number;
  columnLetter: string;
}) {
  const display =
    value.kind === 'unknown'
      ? '—'
      : value.kind === 'negativeKnown'
        ? value.display
        : value.display;

  const isUnknown = value.kind === 'unknown';
  const isNegative = value.kind === 'negativeKnown';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md px-3 py-2 min-h-[80px] border-l-2 transition-colors',
        isWinner ? COLUMN_CHIP_ACCENT[columnIdx] : 'border-border',
        isWinner && COLUMN_BG_TINT[columnIdx],
        !isWinner && 'bg-muted/30',
      )}
      title={isUnknown ? 'Data not yet covered for this property' : undefined}
    >
      <div className="flex items-center gap-1">
        <span
          className={cn(
            'text-lg font-semibold tabular-nums leading-tight text-center',
            isUnknown && 'text-muted-foreground border-b border-dotted border-muted-foreground/40 pb-0.5',
            isNegative && 'text-piq-success',
          )}
        >
          {display}
        </span>
        {isWinner && !isUnknown && (
          <ArrowUp
            className={cn('size-3.5', COLUMN_TEXT_ACCENT[columnIdx])}
            aria-hidden
          />
        )}
      </div>
      <span
        className={cn(
          'mt-1 text-[10px] font-semibold uppercase tracking-wide',
          isWinner ? COLUMN_TEXT_ACCENT[columnIdx] : 'text-muted-foreground',
        )}
      >
        {columnLetter}
      </span>
    </div>
  );
}

export function CompareRow({
  label,
  values,
  columns,
  strategy,
  formatDelta,
}: CompareRowProps) {
  const winner = winnerOf(values, strategy);
  const sentence = diffSentence(values, strategy, columns, formatDelta);

  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </p>
      <div
        className={cn(
          'grid gap-2',
          values.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
        )}
      >
        {values.map((v, idx) => (
          <ValueChip
            key={idx}
            value={v}
            isWinner={winner === idx}
            columnIdx={idx}
            columnLetter={columns[idx].letter}
          />
        ))}
      </div>
      {sentence && (
        <p className="text-xs text-foreground/80 leading-snug pt-0.5">
          {winner !== null ? (
            <>
              <span className={cn('font-semibold', COLUMN_TEXT_ACCENT[winner])}>
                {columns[winner].shortAddress}
              </span>{' '}
              {sentence.replace(`${columns[winner].shortAddress} `, '')}
            </>
          ) : (
            sentence
          )}
        </p>
      )}
    </div>
  );
}

/** Helper to identify whether a row should be collapsed to the "Same:" trailer
 *  rather than rendered as a full card. Exposed so CompareSection can decide. */
export function shouldCollapse(values: CompareValue[]): boolean {
  return isIdentical(values);
}
