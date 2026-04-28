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

/**
 * Per-column accents. Index = column index (A=0, B=1, C=2).
 * - chipBorder = winner's left-border accent
 * - chipBg = subtle background tint (always-on, even for non-winner)
 * - text = number color (always-on, drives the column-identity reinforcement)
 */
const ACCENT_TEXT = ['text-piq-primary', 'text-piq-accent-warm', 'text-piq-primary-dark'];
const ACCENT_BG = ['bg-piq-primary/5', 'bg-piq-accent-warm/5', 'bg-piq-primary-dark/5'];
const ACCENT_BG_WIN = ['bg-piq-primary/10', 'bg-piq-accent-warm/10', 'bg-piq-primary-dark/10'];
const ACCENT_BORDER = ['border-piq-primary', 'border-piq-accent-warm', 'border-piq-primary-dark'];

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
}: {
  value: CompareValue;
  isWinner: boolean;
  columnIdx: number;
}) {
  const isUnknown = value.kind === 'unknown';
  const isNegative = value.kind === 'negativeKnown';
  const display =
    isUnknown ? '—'
    : isNegative ? value.display
    : value.display;

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md px-2.5 py-1.5 min-h-[44px] border-l-2 transition-colors',
        // Always-on column tint when value is present
        isUnknown ? 'bg-muted/40 border-border' :
          isWinner
            ? cn(ACCENT_BG_WIN[columnIdx], ACCENT_BORDER[columnIdx])
            : cn(ACCENT_BG[columnIdx], 'border-border'),
      )}
      title={isUnknown ? 'Data not yet covered for this property' : undefined}
    >
      <div className="flex items-center gap-1 min-w-0">
        <span
          className={cn(
            'text-sm sm:text-base font-semibold tabular-nums leading-tight truncate',
            isUnknown && 'text-muted-foreground border-b border-dotted border-muted-foreground/40 pb-0.5 font-normal',
            isNegative && 'text-piq-success',
            !isUnknown && !isNegative && ACCENT_TEXT[columnIdx],
          )}
        >
          {display}
        </span>
        {isWinner && !isUnknown && (
          <ArrowUp
            className={cn('size-3 shrink-0', ACCENT_TEXT[columnIdx])}
            aria-hidden
          />
        )}
      </div>
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
  const same = isIdentical(values);

  // Pre-strip the leading "{address} " from the diff so we can color the
  // address ourselves in the inline render.
  const sentenceTail =
    winner !== null && sentence
      ? sentence.replace(`${columns[winner].shortAddress} `, '')
      : sentence;

  const colCount = values.length;

  return (
    <div
      className={cn(
        'group/compare-row',
        // Mobile: stacked card. Desktop: table-like row.
        'sm:grid sm:items-center sm:gap-3',
        colCount === 2
          ? 'sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_minmax(180px,1.4fr)]'
          : 'sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(180px,1.2fr)]',
        // Identical rows are still visible but visually de-emphasised so the
        // eye lands on rows that actually differ. The user can still read the
        // value if they care; it just doesn't compete with the diff rows.
        same && 'opacity-55',
      )}
    >
      {/* Label */}
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px] sm:normal-case sm:tracking-normal sm:font-normal sm:text-foreground/80 mb-1.5 sm:mb-0">
        {label}
      </p>

      {/* Value chips — mobile: 2-up grid; desktop: each in its own grid column */}
      <div
        className={cn(
          'grid gap-2 sm:contents',
          colCount === 2 ? 'grid-cols-2' : 'grid-cols-3',
        )}
      >
        {values.map((v, idx) => (
          <ValueChip
            key={idx}
            value={v}
            isWinner={winner === idx}
            columnIdx={idx}
          />
        ))}
      </div>

      {/* Diff sentence — when identical, render a quiet "Same" label instead
          so the row still shows a status without the user wondering why the
          diff column is empty. */}
      {sentence ? (
        <p className="mt-1.5 sm:mt-0 text-[11px] sm:text-xs text-muted-foreground leading-snug sm:text-right">
          {winner !== null ? (
            <>
              <span className={cn('font-semibold', ACCENT_TEXT[winner])}>
                {columns[winner].shortAddress}
              </span>{' '}
              {sentenceTail}
            </>
          ) : (
            sentence
          )}
        </p>
      ) : same ? (
        <p className="mt-1.5 sm:mt-0 text-[11px] sm:text-xs italic text-muted-foreground/70 sm:text-right">
          Same on both
        </p>
      ) : null}
    </div>
  );
}

/** Helper to identify whether a row should be collapsed to the "Same:" trailer
 *  rather than rendered as a full card. Exposed so CompareSection can decide. */
export function shouldCollapse(values: CompareValue[]): boolean {
  return isIdentical(values);
}
