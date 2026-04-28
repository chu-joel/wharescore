'use client';

import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useComparedReports } from '@/hooks/useComparedReports';
import { useComparisonStore } from '@/stores/comparisonStore';
import { usePersonaStore } from '@/stores/personaStore';
import { orderedSections } from '@/lib/compareSections';
import type { ColumnLabel } from '@/lib/compareDiff';
import { CompareHeader } from './CompareHeader';
import { CompareScoreboard } from './CompareScoreboard';
import { CompareSection } from './CompareSection';
import { CompareLockedSection } from './CompareLockedSection';

const COLUMN_LETTERS = ['A', 'B', 'C'] as const;

function shortAddress(full: string): string {
  // Take everything before the first comma; truncate to 24 chars.
  const head = (full || '').split(',')[0]?.trim() || full;
  return head.length > 24 ? `${head.slice(0, 24)}…` : head;
}

export function CompareView({ addressIds }: { addressIds: number[] }) {
  const { reports, loading, errors } = useComparedReports(addressIds);
  const persona = usePersonaStore((s) => s.persona);
  const stagedItems = useComparisonStore((s) => s.items);

  const sections = useMemo(() => orderedSections(persona), [persona]);

  // Build column labels from whichever data we have. Prefer the loaded report's
  // address; fall back to the staged item; last resort is the raw id.
  const fallbacks = addressIds.map((id) => {
    const staged = stagedItems.find((s) => s.addressId === id);
    return {
      addressId: id,
      fullAddress: staged?.fullAddress ?? '',
      suburb: staged?.suburb ?? '',
    };
  });

  const columns: ColumnLabel[] = addressIds.map((id, idx) => {
    const r = reports[idx];
    const staged = stagedItems.find((s) => s.addressId === id);
    const full = r?.address.full_address ?? staged?.fullAddress ?? `Property ${idx + 1}`;
    return {
      letter: COLUMN_LETTERS[idx],
      shortAddress: shortAddress(full),
    };
  });

  // Only render scoreboard + sections when ALL reports are loaded — partial
  // diffs would be misleading. Show skeletons until all are ready.
  const safeReports = reports.filter((r): r is NonNullable<typeof r> => r != null);
  const allReady = safeReports.length === reports.length;

  return (
    <div>
      <CompareHeader reports={reports} addressIds={addressIds} fallbackAddresses={fallbacks} />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-3 pb-24 sm:pt-5 sm:pb-12 space-y-3 sm:space-y-4">
        {!allReady ? (
          <ScoreboardSkeleton count={addressIds.length} />
        ) : (
          <CompareScoreboard
            reports={safeReports}
            columns={columns}
            persona={persona}
          />
        )}

        {errors.some((e) => e) && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            We couldn&rsquo;t load one of the properties. Try refreshing or removing it from the tray.
          </div>
        )}

        <div className="space-y-2">
          {sections.map((section) => {
            const defaultOpen =
              section.defaultOpenOn?.includes(persona) ||
              section.defaultOpenOn?.includes('desktop');
            return (
              <div key={section.id}>
                {!allReady ? (
                  <SectionSkeleton title={section.title} />
                ) : (
                  <CompareSection
                    section={section}
                    reports={safeReports}
                    columns={columns}
                    defaultOpen={defaultOpen}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Locked features — always visible, encourages upgrade after the user
            has experienced the free comparison. */}
        {allReady && <CompareLockedSection addressIds={addressIds} />}

        {/* Loading indicator */}
        {loading && !allReady && (
          <p className="text-xs text-muted-foreground text-center">
            Loading comparison data&hellip;
          </p>
        )}
      </main>
    </div>
  );
}

function ScoreboardSkeleton({ count }: { count: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div
            className={
              count === 2
                ? 'grid grid-cols-2 gap-2'
                : 'grid grid-cols-3 gap-2'
            }
          >
            {Array.from({ length: count }).map((_, j) => (
              <Skeleton key={j} className="h-20 rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold leading-tight">
            {title}
          </h3>
          <Skeleton className="h-3 w-32 mt-1" />
        </div>
        <Skeleton className="size-5 rounded" />
      </div>
    </div>
  );
}
