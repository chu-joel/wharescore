'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, ExternalLink } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { useComparisonStore } from '@/stores/comparisonStore';
import { usePersonaStore } from '@/stores/personaStore';
import { getRatingBin } from '@/lib/constants';
import { cn } from '@/lib/utils';

const COLUMN_LETTERS = ['A', 'B', 'C'] as const;
const COLUMN_CHIP = [
  'bg-piq-primary text-white',
  'bg-piq-accent-warm text-white',
  'bg-piq-primary-dark text-white',
];

interface CompareHeaderProps {
  reports: Array<PropertyReport | null>;
  addressIds: number[];
  fallbackAddresses: Array<{ addressId: number; fullAddress: string; suburb: string }>;
}

export function CompareHeader({ reports, addressIds, fallbackAddresses }: CompareHeaderProps) {
  const remove = useComparisonStore((s) => s.remove);
  const persona = usePersonaStore((s) => s.persona);
  const setPersona = usePersonaStore((s) => s.setPersona);
  const router = useRouter();

  // Removing a column on the /compare page must update both the tray store
  // and the URL — otherwise the page keeps trying to render the removed id.
  // Either way the user goes back to the map: 0 left = empty tray, 1 left =
  // the surviving property is still in the tray so they can pick a partner.
  const removeColumn = (id: number) => {
    remove(id);
    router.push('/');
  };

  return (
    <div className="sticky top-0 z-30 bg-background/95 supports-[backdrop-filter]:backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {/* Persona toggle row */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base sm:text-lg font-semibold">Comparing properties</h1>
          <div
            role="group"
            aria-label="Persona"
            className="inline-flex rounded-md border border-border p-0.5 text-xs sm:text-sm"
          >
            {(['renter', 'buyer'] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={persona === p}
                onClick={() => setPersona(p)}
                className={cn(
                  'px-3 py-1 rounded transition-colors capitalize',
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

        {/* Address columns */}
        <div
          className={cn(
            'grid gap-2 sm:gap-3',
            reports.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
          )}
        >
          {reports.map((report, idx) => {
            const fallback = fallbackAddresses[idx];
            const address = report?.address.full_address ?? fallback?.fullAddress ?? 'Loading…';
            const suburb = report?.address.suburb ?? fallback?.suburb ?? '';
            const score = report?.scores?.overall;
            const bin = typeof score === 'number' ? getRatingBin(score) : null;
            const id = report?.address.address_id ?? fallback?.addressId;

            return (
              <div
                key={idx}
                className="flex items-start gap-2 min-w-0 p-2 rounded-md bg-muted/20"
              >
                <div
                  className={cn(
                    'flex items-center justify-center size-8 sm:size-9 rounded-md text-xs sm:text-sm font-bold shrink-0',
                    COLUMN_CHIP[idx],
                  )}
                  aria-label={`Property ${COLUMN_LETTERS[idx]}`}
                >
                  {COLUMN_LETTERS[idx]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium leading-tight truncate">
                    {address}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {suburb}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {bin && typeof score === 'number' && (
                      <span
                        className="inline-flex items-center justify-center size-5 sm:size-6 rounded-full text-[10px] sm:text-xs font-bold text-white tabular-nums"
                        style={{ backgroundColor: bin.color }}
                        title={`${bin.label} risk`}
                      >
                        {Math.round(score)}
                      </span>
                    )}
                    {id && (
                      <Link
                        href={`/?address=${id}`}
                        className="text-[10px] sm:text-xs text-piq-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        Open <ExternalLink className="size-3" />
                      </Link>
                    )}
                  </div>
                </div>
                {id && (
                  <button
                    type="button"
                    onClick={() => removeColumn(id)}
                    aria-label={`Remove ${address} from comparison`}
                    className="shrink-0 p-1 rounded text-muted-foreground hover:text-piq-accent-hot hover:bg-muted"
                  >
                    <X className="size-3.5 sm:size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
