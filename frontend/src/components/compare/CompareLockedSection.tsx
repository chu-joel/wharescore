'use client';

import Link from 'next/link';
import { Lock, Sparkles, ArrowRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompareLockedSectionProps {
  /** Address ids of staged properties — used to deep-link the user to each
   *  property page so they can generate a full report. */
  addressIds: number[];
  /** Compact = thin one-line banner (used inline mid-page). Full = the
   *  expanded card with feature list (used at the end of the page). */
  variant?: 'full' | 'compact';
}

const LOCKED_FEATURES: Array<{ label: string; teaser: string }> = [
  {
    label: 'Price estimate (P50)',
    teaser: 'Pinpoint asking-price-vs-fair-value with HPI + yield ensemble.',
  },
  {
    label: 'Rent advisor verdict',
    teaser: 'Below-market / fair / overpriced calls with confidence band.',
  },
  {
    label: 'AI buyer/renter summary',
    teaser: 'One-paragraph plain-English verdict for each property.',
  },
  {
    label: 'PM-peak transit times',
    teaser: 'Real travel time to the CBD and other key destinations.',
  },
  {
    label: 'HPI 12-month trend',
    teaser: 'Capital growth trajectory for each suburb.',
  },
  {
    label: 'School zone details',
    teaser: 'Zoned schools per level with deciles and walking distance.',
  },
  {
    label: 'Recommendations & action items',
    teaser: 'Specific due-diligence steps tailored to each property.',
  },
  {
    label: 'Hazard advice',
    teaser: 'Insurance asks, evacuation routes, council questions to check.',
  },
];

export function CompareLockedSection({
  addressIds,
  variant = 'full',
}: CompareLockedSectionProps) {
  if (variant === 'compact') {
    return (
      <Link
        href={addressIds[0] ? `/property/${addressIds[0]}` : '/'}
        aria-label="Unlock more comparison data with a full report"
        className={cn(
          'flex items-center gap-2 rounded-md border border-piq-primary/30',
          'bg-gradient-to-r from-piq-primary/5 to-piq-accent-warm/5',
          'px-3 py-2 transition-colors hover:border-piq-primary/50 hover:bg-piq-primary/10',
        )}
      >
        <Sparkles className="size-3.5 shrink-0 text-piq-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-xs sm:text-sm leading-snug">
          <span className="font-semibold">More side-by-side data with the full report</span>
          <span className="hidden sm:inline text-muted-foreground">
            {' '}— price estimates, AI verdict, PM transit, HPI, school zones, recommendations.
          </span>
        </p>
        <ChevronRight className="size-4 shrink-0 text-piq-primary" aria-hidden />
      </Link>
    );
  }

  return (
    <section
      aria-label="Locked comparison features"
      className={cn(
        'rounded-xl border border-piq-primary/30 bg-gradient-to-br from-piq-primary/5 via-card to-piq-accent-warm/5',
        'p-4 sm:p-6 space-y-4',
      )}
    >
      <header className="flex items-start gap-3">
        <div className="shrink-0 inline-flex items-center justify-center size-9 rounded-md bg-piq-primary text-white">
          <Sparkles className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold leading-tight">
            More side-by-side data with the full report
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Generate a full report on each property — every additional metric
            below stacks into this comparison automatically.
          </p>
        </div>
      </header>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {LOCKED_FEATURES.map((f) => (
          <li
            key={f.label}
            className="flex items-start gap-2 p-2.5 rounded-md bg-background/60 border border-border/60"
          >
            <Lock
              className="size-3.5 mt-0.5 shrink-0 text-piq-primary"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{f.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {f.teaser}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          $9.99 single, or unlimited with Pro. Reports persist forever and
          appear in your account.
        </p>
        <div
          className={cn(
            'flex flex-wrap gap-2',
            addressIds.length === 2 ? '' : 'sm:justify-end',
          )}
        >
          {addressIds.map((id, idx) => (
            <Link
              key={id}
              href={`/property/${id}`}
              className={cn(
                'inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs sm:text-sm font-medium transition-colors',
                'bg-piq-primary text-white hover:bg-piq-primary-dark',
              )}
            >
              Get full report ({String.fromCharCode(65 + idx)})
              <ArrowRight className="size-3.5" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
