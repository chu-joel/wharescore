'use client';

import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useComparedReports } from '@/hooks/useComparedReports';
import { useComparisonStore } from '@/stores/comparisonStore';
import { usePersonaStore } from '@/stores/personaStore';
import { orderedSections } from '@/lib/compareSections';
import { buildVerdict } from '@/lib/compareVerdict';
import type { ColumnLabel } from '@/lib/compareDiff';
import { CompareHeader } from './CompareHeader';
import { CompareScoreboard } from './CompareScoreboard';
import { CompareSection } from './CompareSection';
import { CompareLockedSection } from './CompareLockedSection';
import { HeadToHeadVerdict } from './HeadToHeadVerdict';

const COLUMN_LETTERS = ['A', 'B', 'C'] as const;

function shortAddress(full: string): string {
  const head = (full || '').split(',')[0]?.trim() || full;
  return head.length > 24 ? `${head.slice(0, 24)}…` : head;
}

export function CompareView({ addressIds }: { addressIds: number[] }) {
  const { reports, loading, errors } = useComparedReports(addressIds);
  const persona = usePersonaStore((s) => s.persona);
  const stagedItems = useComparisonStore((s) => s.items);
  const [hideSame, setHideSame] = useState(false);

  const sections = useMemo(() => orderedSections(persona), [persona]);

  const fallbacks = addressIds.map((id) => {
    const staged = stagedItems.find((s) => s.addressId === id);
    return {
      addressId: id,
      fullAddress: staged?.fullAddress ?? '',
      suburb: staged?.suburb ?? '',
      lat: staged?.lat,
      lng: staged?.lng,
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

  const safeReports = reports.filter((r): r is NonNullable<typeof r> => r != null);
  const allReady = safeReports.length === reports.length;

  // Verdict only computed once everything is loaded — partial verdicts are
  // misleading.
  const verdict = useMemo(() => {
    if (!allReady) return null;
    return buildVerdict(safeReports, columns);
  }, [allReady, safeReports, columns]);

  // The first non-priority section index for the inline locked banner.
  // We tuck the upsell mid-page so users see it after experiencing some
  // free value but before they've exhausted attention.
  const lockedAfterIdx = Math.min(2, sections.length - 1);

  return (
    <div>
      <CompareHeader
        reports={reports}
        addressIds={addressIds}
        fallbackAddresses={fallbacks}
        hideSame={hideSame}
        onToggleHideSame={() => setHideSame((h) => !h)}
      />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-3 pb-24 sm:pt-5 sm:pb-12 space-y-3 sm:space-y-4">
        {/* HEAD-TO-HEAD VERDICT — the answer the user actually came for. */}
        {allReady && verdict && (
          <HeadToHeadVerdict verdict={verdict} columns={columns} />
        )}

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
          {sections.map((section, idx) => {
            const isPriority = !!section.defaultOpenOn?.includes(persona);
            const defaultOpen =
              isPriority || section.defaultOpenOn?.includes('desktop');
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
                    isPriority={isPriority}
                    hideSame={hideSame}
                  />
                )}

                {/* Inline THIN banner after the persona-priority sections.
                    Big card-style upsell would break the section flow; the
                    compact variant is a single-line CTA that signals more
                    is available without interrupting the scan. The full
                    card lives at the bottom for the close. */}
                {allReady && idx === lockedAfterIdx && (
                  <div className="mt-2">
                    <CompareLockedSection
                      addressIds={addressIds}
                      variant="compact"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Full locked-features card at the bottom — the close. */}
        {allReady && (
          <CompareLockedSection addressIds={addressIds} />
        )}

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
