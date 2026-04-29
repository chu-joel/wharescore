'use client';

import { Trophy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompareVerdict } from '@/lib/compareVerdict';
import type { ColumnLabel } from '@/lib/compareDiff';

const COLUMN_TEXT = ['text-piq-primary', 'text-piq-accent-warm', 'text-piq-primary-dark'];
const COLUMN_BG = ['bg-piq-primary', 'bg-piq-accent-warm', 'bg-piq-primary-dark'];
const COLUMN_BG_SOFT = ['bg-piq-primary/10', 'bg-piq-accent-warm/10', 'bg-piq-primary-dark/10'];
const COLUMN_BORDER = ['border-piq-primary/30', 'border-piq-accent-warm/30', 'border-piq-primary-dark/30'];

interface HeadToHeadVerdictProps {
  verdict: CompareVerdict;
  columns: ColumnLabel[];
}

export function HeadToHeadVerdict({ verdict, columns }: HeadToHeadVerdictProps) {
  const { wins, highlights, overall, rowsCompared } = verdict;
  const maxWins = Math.max(...wins);
  const leaderIdx = wins.indexOf(maxWins);
  const winsTied = wins.filter((w) => w === maxWins).length > 1;

  return (
    <section
      aria-label="Head-to-head verdict"
      className="rounded-xl border bg-card shadow-sm overflow-hidden"
    >
      {/* Eyebrow + overall verdict */}
      <header className="px-4 sm:px-5 pt-3 sm:pt-4 pb-2 flex items-center gap-2 border-b border-border/50">
        <Sparkles className="size-3.5 text-piq-primary shrink-0" aria-hidden />
        <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Quick read · {rowsCompared} measurable rows
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] sm:text-xs">
          {!winsTied && rowsCompared > 0 && (
            <Trophy className={cn('size-3.5', COLUMN_TEXT[leaderIdx])} aria-hidden />
          )}
          <span
            className={cn(
              'font-semibold',
              !winsTied && rowsCompared > 0 ? COLUMN_TEXT[leaderIdx] : 'text-muted-foreground',
            )}
          >
            {overall}
          </span>
        </span>
      </header>

      {/* Win counts strip — tiny visual showing the score */}
      <div className="px-4 sm:px-5 pt-3 flex items-center gap-2">
        {columns.map((col, idx) => (
          <div
            key={idx}
            className={cn(
              'flex-1 flex items-center gap-2 p-2 rounded-md border',
              wins[idx] === maxWins && rowsCompared > 0 && !winsTied
                ? cn(COLUMN_BG_SOFT[idx], COLUMN_BORDER[idx])
                : 'bg-muted/20 border-border',
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center size-7 rounded-md text-xs font-bold shrink-0 text-white',
                COLUMN_BG[idx],
              )}
            >
              {col.letter}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">
                Wins
              </p>
              <p className="text-base sm:text-lg font-bold tabular-nums leading-none">
                <span className={COLUMN_TEXT[idx]}>{wins[idx]}</span>
                <span className="text-muted-foreground/60 text-xs font-normal ml-1">
                  / {rowsCompared}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-column highlights — three best wins each */}
      <div className="p-4 sm:p-5 pt-3 space-y-2">
        {columns.map((col, idx) => {
          const top = highlights.filter((h) => h.winner === idx).slice(0, 3);
          if (top.length === 0) return null;
          return (
            <div
              key={idx}
              className={cn(
                'flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-1.5 first:pt-0 last:pb-0',
              )}
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    'inline-flex items-center justify-center size-5 rounded-md text-[10px] font-bold text-white',
                    COLUMN_BG[idx],
                  )}
                >
                  {col.letter}
                </span>
                <span className={cn('text-xs sm:text-sm font-semibold', COLUMN_TEXT[idx])}>
                  {col.shortAddress}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-foreground/85 leading-snug">
                {top.map((h, i) => (
                  <span key={h.rowId}>
                    {i > 0 && <span className="text-muted-foreground/60"> · </span>}
                    <a
                      href={`#section-${h.sectionId}`}
                      className="hover:underline"
                      title={`Jump to ${h.sectionTitle}`}
                    >
                      {h.clause}
                    </a>
                  </span>
                ))}
              </p>
            </div>
          );
        })}

        {highlights.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            These properties look closely matched on every measurable metric.
            Drill into the sections below for the detail.
          </p>
        )}
      </div>
    </section>
  );
}
