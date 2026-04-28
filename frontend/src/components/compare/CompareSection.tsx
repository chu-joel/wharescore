'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompareRow, shouldCollapse } from './CompareRow';
import { winnerOf, type ColumnLabel } from '@/lib/compareDiff';
import type { SectionDef } from '@/lib/compareSections';
import type { PropertyReport } from '@/lib/types';

interface CompareSectionProps {
  section: SectionDef;
  reports: PropertyReport[];
  columns: ColumnLabel[];
  defaultOpen?: boolean;
}

export function CompareSection({
  section,
  reports,
  columns,
  defaultOpen = false,
}: CompareSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Compute values once per row.
  const computed = section.rows.map((row) => {
    const values = reports.map((r) => row.extract(r));
    return {
      row,
      values,
      collapsed: shouldCollapse(values),
    };
  });

  const visibleRows = computed.filter((c) => !c.collapsed);
  const collapsedRows = computed.filter((c) => c.collapsed);

  // Section-level summary: count winning rows per column to suggest "A wins on
  // most metrics" or "Mixed". This is intentionally fuzzy — the section
  // accordion is meant to invite drill-down, not deliver the verdict.
  const winners = visibleRows
    .map((c) => winnerOf(c.values, c.row.strategy))
    .filter((w): w is number => w !== null);

  let headerSentence: string | null = null;
  if (winners.length > 0) {
    const counts = new Array(columns.length).fill(0);
    winners.forEach((w) => (counts[w] += 1));
    const top = counts.indexOf(Math.max(...counts));
    const topCount = counts[top];
    const totalDifferences = winners.length;
    if (topCount === totalDifferences && totalDifferences >= 1) {
      headerSentence = `${columns[top].shortAddress} is stronger here`;
    } else if (topCount > totalDifferences / 2) {
      headerSentence = `${columns[top].shortAddress} leads on most metrics`;
    } else {
      headerSentence = 'Mixed — varies by metric';
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-colors',
        open ? 'border-piq-primary/30' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 sm:p-5 text-left"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold leading-tight">
            {section.title}
          </h3>
          {headerSentence && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {headerSentence}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'size-5 text-muted-foreground shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No measurable differences in this section.
            </p>
          ) : (
            visibleRows.map(({ row, values }) => (
              <CompareRow
                key={row.id}
                label={row.label}
                values={values}
                columns={columns}
                strategy={row.strategy}
                formatDelta={row.formatDelta}
              />
            ))
          )}

          {collapsedRows.length > 0 && (
            <div className="pt-3 border-t border-border/40">
              <p className="text-xs italic text-muted-foreground/80 leading-relaxed">
                <span className="font-medium not-italic">Same on both:</span>{' '}
                {collapsedRows
                  .map((c) => {
                    const v = c.values[0];
                    if (v.kind === 'unknown') return `${c.row.label} (data not available)`;
                    if (v.kind === 'negativeKnown') return `${c.row.label} (${v.display})`;
                    return `${c.row.label} (${v.display})`;
                  })
                  .join(', ')}
                .
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
