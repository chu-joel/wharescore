'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { X, ExternalLink, ArrowLeftRight, Plus, EyeOff, Eye, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { PropertyReport } from '@/lib/types';
import { useComparisonStore, COMPARE_MAX_ANONYMOUS } from '@/stores/comparisonStore';
import { usePersonaStore, type Persona } from '@/stores/personaStore';
import { getRatingBin } from '@/lib/constants';
import { distanceKm, formatDistance } from '@/lib/compareVerdict';
import { cn } from '@/lib/utils';

const COLUMN_LETTERS = ['A', 'B', 'C'] as const;
const COLUMN_CHIP = [
  'bg-piq-primary text-white',
  'bg-piq-accent-warm text-white',
  'bg-piq-primary-dark text-white',
];
const COLUMN_RING = [
  'ring-piq-primary/30',
  'ring-piq-accent-warm/30',
  'ring-piq-primary-dark/30',
];

interface CompareHeaderProps {
  reports: Array<PropertyReport | null>;
  addressIds: number[];
  fallbackAddresses: Array<{
    addressId: number;
    fullAddress: string;
    suburb: string;
    lat?: number;
    lng?: number;
  }>;
  hideSame: boolean;
  onToggleHideSame: () => void;
}

export function CompareHeader({
  reports,
  addressIds,
  fallbackAddresses,
  hideSame,
  onToggleHideSame,
}: CompareHeaderProps) {
  const remove = useComparisonStore((s) => s.remove);
  const stagedItems = useComparisonStore((s) => s.items);
  const persona = usePersonaStore((s) => s.persona);
  const setPersona = usePersonaStore((s) => s.setPersona);
  const router = useRouter();

  const removeColumn = (id: number) => {
    remove(id);
    router.push('/');
  };

  const swapAB = () => {
    if (addressIds.length < 2) return;
    const swapped = [addressIds[1], addressIds[0], ...addressIds.slice(2)];
    router.replace(`/compare?ids=${swapped.join(',')}`);
  };

  const handlePersonaChange = (p: Persona) => {
    if (p === persona) return;
    setPersona(p);
    toast(`Showing ${p} view`, {
      description: p === 'renter'
        ? 'Sections reordered: market, liveability, transport first.'
        : 'Sections reordered: risk, market, planning first.',
      duration: 2200,
    });
  };

  // Distance between A and B (only when both have lat/lng available).
  const distance = useMemo(() => {
    const pts = addressIds.map((id, idx) => {
      const r = reports[idx];
      const f = fallbackAddresses[idx];
      const lat = r?.address.lat ?? f?.lat;
      const lng = r?.address.lng ?? f?.lng;
      return lat != null && lng != null ? { lat, lng, addressId: id } : null;
    });
    const valid = pts.filter((p): p is NonNullable<typeof p> => p !== null);
    if (valid.length < 2) return null;
    return distanceKm(valid[0], valid[1]);
  }, [addressIds, reports, fallbackAddresses]);

  // Coverage chip per column ("38/40 checks").
  const coverageFor = (idx: number): { available: number; total: number } | null => {
    const r = reports[idx];
    const c = r?.coverage;
    if (!c) return null;
    return { available: c.available, total: c.total };
  };

  const canAddThird =
    addressIds.length < COMPARE_MAX_ANONYMOUS &&
    stagedItems.length < COMPARE_MAX_ANONYMOUS;

  return (
    <div className="sticky top-0 z-30 bg-background/95 supports-[backdrop-filter]:backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
        {/* Top row: title + persona toggle + toolbar */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-semibold leading-tight">
              Comparing
            </h1>
            {distance != null && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                <MapPin className="size-3" aria-hidden />
                {formatDistance(distance)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Persona toggle */}
            <div
              role="group"
              aria-label="Persona"
              className="inline-flex rounded-md border border-border p-0.5 text-xs"
            >
              {(['renter', 'buyer'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={persona === p}
                  onClick={() => handlePersonaChange(p)}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors capitalize',
                    persona === p
                      ? 'bg-piq-primary text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile distance pill (the row above is too crowded on phone) */}
        {distance != null && (
          <div className="sm:hidden mb-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              <MapPin className="size-3" aria-hidden />
              {formatDistance(distance)}
            </span>
          </div>
        )}

        {/* Address columns */}
        <div
          className={cn(
            'grid gap-2 sm:gap-3',
            addressIds.length === 2
              ? canAddThird
                ? 'grid-cols-[1fr_1fr_auto]'
                : 'grid-cols-2'
              : 'grid-cols-3',
          )}
        >
          {addressIds.map((id, idx) => {
            const report = reports[idx];
            const fallback = fallbackAddresses[idx];
            const address = report?.address.full_address ?? fallback?.fullAddress ?? 'Loading…';
            const suburb = report?.address.suburb ?? fallback?.suburb ?? '';
            const score = report?.scores?.overall;
            const bin = typeof score === 'number' ? getRatingBin(score) : null;
            const cov = coverageFor(idx);

            return (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-2 min-w-0 p-2 rounded-md bg-muted/20 ring-1 ring-inset',
                  COLUMN_RING[idx],
                )}
              >
                <Link
                  href={`/?address=${id}`}
                  className={cn(
                    'flex items-center justify-center size-8 sm:size-9 rounded-md text-xs sm:text-sm font-bold shrink-0 transition-transform hover:scale-105',
                    COLUMN_CHIP[idx],
                  )}
                  aria-label={`Open Property ${COLUMN_LETTERS[idx]} (${address})`}
                  title={`Open ${address}`}
                >
                  {COLUMN_LETTERS[idx]}
                </Link>
                <Link
                  href={`/?address=${id}`}
                  className="min-w-0 flex-1 group/col"
                >
                  <p className="text-xs sm:text-sm font-medium leading-tight truncate group-hover/col:underline">
                    {address}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {suburb}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {bin && typeof score === 'number' && (
                      <span
                        className="inline-flex items-center justify-center size-5 sm:size-6 rounded-full text-[10px] sm:text-xs font-bold text-white tabular-nums"
                        style={{ backgroundColor: bin.color }}
                        title={`${bin.label} risk score: ${Math.round(score)}/100`}
                      >
                        {Math.round(score)}
                      </span>
                    )}
                    {cov && (
                      <span
                        className="inline-flex items-center text-[10px] text-muted-foreground/90 tabular-nums"
                        title={`${cov.available} of ${cov.total} data checks available for this property`}
                      >
                        {cov.available}/{cov.total} checks
                      </span>
                    )}
                    <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-xs text-piq-primary group-hover/col:underline ml-auto">
                      Open <ExternalLink className="size-3" />
                    </span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeColumn(id);
                  }}
                  aria-label={`Remove ${address} from comparison`}
                  className="shrink-0 p-1 rounded text-muted-foreground hover:text-piq-accent-hot hover:bg-muted"
                >
                  <X className="size-3.5 sm:size-4" />
                </button>
              </div>
            );
          })}

          {/* "+ Add" placeholder column — only when there's room */}
          {canAddThird && (
            <Link
              href="/"
              className={cn(
                'flex items-center justify-center min-h-[68px] sm:min-h-[78px] rounded-md',
                'border border-dashed border-piq-primary/40 bg-piq-primary/5',
                'text-piq-primary text-xs sm:text-sm font-medium',
                'hover:bg-piq-primary/10 hover:border-piq-primary transition-colors',
                'px-2',
              )}
              title="Pick another property from the map"
            >
              <Plus className="size-4 mr-1" />
              <span className="hidden sm:inline">Add property</span>
              <span className="sm:hidden">Add</span>
            </Link>
          )}
        </div>

        {/* Toolbar — sits below the addresses to avoid crowding the top row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {addressIds.length >= 2 && (
            <button
              type="button"
              onClick={swapAB}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Swap A and B"
            >
              <ArrowLeftRight className="size-3" aria-hidden />
              <span>Swap A↔B</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleHideSame}
            aria-pressed={hideSame}
            className={cn(
              'inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 py-1 rounded-md transition-colors',
              hideSame
                ? 'bg-piq-primary text-white hover:bg-piq-primary-dark'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground',
            )}
            title={hideSame ? 'Show rows that match on both' : 'Hide rows that match on both'}
          >
            {hideSame ? <Eye className="size-3" aria-hidden /> : <EyeOff className="size-3" aria-hidden />}
            <span>{hideSame ? 'Show same' : 'Hide same'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
