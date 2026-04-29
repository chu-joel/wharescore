'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompareRow } from './CompareRow';
import { winnerOf, isIdentical, type ColumnLabel } from '@/lib/compareDiff';
import type { SectionDef } from '@/lib/compareSections';
import type { PropertyReport } from '@/lib/types';

interface CompareSectionProps {
  section: SectionDef;
  reports: PropertyReport[];
  columns: ColumnLabel[];
  defaultOpen?: boolean;
  /** Show persona-priority star? */
  isPriority?: boolean;
  /** Hide identical rows entirely (driven by header toggle). */
  hideSame?: boolean;
}

const COLUMN_TEXT = ['text-piq-primary', 'text-piq-accent-warm', 'text-piq-primary-dark'];
const COLUMN_BG = ['bg-piq-primary', 'bg-piq-accent-warm', 'bg-piq-primary-dark'];

export function CompareSection({
  section,
  reports,
  columns,
  defaultOpen = false,
  isPriority = false,
  hideSame = false,
}: CompareSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Honor URL hash — `/compare?ids=A,B#section-risk` opens with risk auto-expanded.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash === `#section-${section.id}`) {
      setOpen(true);
      // Smooth-scroll to it after layout
      const el = document.getElementById(`section-${section.id}`);
      if (el) {
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    }
  }, [section.id]);

  // Compute values once per row.
  const computed = section.rows.map((row) => {
    const values = reports.map((r) => row.extract(r));
    const same = isIdentical(values);
    return { row, values, same };
  });
  const visible = hideSame ? computed.filter((c) => !c.same) : computed;

  // Per-column win counts for this section
  const wins = new Array<number>(columns.length).fill(0);
  let totalRanked = 0;
  for (const c of computed) {
    const w = winnerOf(c.values, c.row.strategy);
    if (w !== null) {
      wins[w] += 1;
      totalRanked += 1;
    }
  }

  return (
    <div
      id={`section-${section.id}`}
      className={cn(
        'rounded-lg border bg-card transition-colors scroll-mt-20',
        open ? 'border-piq-primary/30 shadow-sm' : 'border-border',
        // Persona-priority gets a subtle left accent stripe.
        isPriority && 'border-l-[3px] border-l-piq-primary',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-left"
      >
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {isPriority && (
            <Star
              className="size-3.5 shrink-0 fill-piq-primary text-piq-primary"
              aria-label="Priority for this persona"
            />
          )}
          <h3 className="text-sm sm:text-base font-semibold leading-tight">
            {section.title}
          </h3>
        </div>

        {/* Win-count chips — give a glanceable score per section */}
        {totalRanked > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0 mr-1">
            {columns.map((col, idx) => (
              <span
                key={idx}
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] tabular-nums px-1.5 py-0.5 rounded-md',
                  wins[idx] > 0 ? 'bg-muted/60' : 'bg-muted/30 opacity-50',
                )}
                title={`${col.shortAddress}: wins ${wins[idx]} of ${totalRanked}`}
              >
                <span
                  className={cn(
                    'inline-block size-3 rounded-sm shrink-0',
                    COLUMN_BG[idx],
                  )}
                  aria-hidden
                />
                <span className={cn('font-semibold', COLUMN_TEXT[idx])}>
                  {wins[idx]}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Mobile: combined inline tally */}
        {totalRanked > 0 && (
          <span className="sm:hidden text-[11px] text-muted-foreground tabular-nums shrink-0 mr-1">
            {wins.map((w, i) => (
              <span key={i}>
                <span className={cn('font-semibold', COLUMN_TEXT[i])}>{w}</span>
                {i < wins.length - 1 && '–'}
              </span>
            ))}
          </span>
        )}

        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-2.5 sm:space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {visible.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              All rows in this section are the same — toggle &ldquo;Show same&rdquo; in the header to view them.
            </p>
          ) : (
            visible.map(({ row, values }) => (
              <CompareRow
                key={row.id}
                label={row.label}
                values={values}
                columns={columns}
                strategy={row.strategy}
                formatDelta={row.formatDelta}
                helpText={row.help}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
