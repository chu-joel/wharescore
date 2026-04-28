'use client';

import Link from 'next/link';
import { GitCompare, Search } from 'lucide-react';
import type { ComparisonItem } from '@/stores/comparisonStore';

export function CompareEmptyState({
  staged,
  reason,
}: {
  staged: ComparisonItem[];
  reason: 'none' | 'one' | 'invalid';
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 sm:py-20 text-center">
      <div className="inline-flex items-center justify-center size-14 rounded-full bg-piq-primary/10 text-piq-primary mb-4">
        <GitCompare className="size-7" />
      </div>
      <h1 className="text-xl sm:text-2xl font-bold mb-2">
        {reason === 'none'
          ? 'Add 2 properties to compare'
          : reason === 'one'
            ? 'Add one more property'
            : 'We couldn’t load that comparison'}
      </h1>
      <p className="text-sm sm:text-base text-muted-foreground mb-6">
        {reason === 'none'
          ? 'Search for any NZ address and click "Compare" on the property page. You can stage up to 2 properties at once.'
          : reason === 'one'
            ? `You have ${staged[0]?.fullAddress ?? 'one property'} staged. Search for another to see them side by side.`
            : 'The properties in this link are no longer available. Try comparing two new ones.'}
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-piq-primary text-white text-sm font-medium hover:bg-piq-primary-dark transition-colors"
      >
        <Search className="size-4" />
        Search for a property
      </Link>
      {staged.length > 0 && (
        <div className="mt-8 text-left">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Already staged
          </h2>
          <ul className="space-y-1">
            {staged.map((item) => (
              <li
                key={item.addressId}
                className="text-sm flex items-center gap-2"
              >
                <span className="size-1.5 rounded-full bg-piq-primary" />
                <Link
                  href={`/property/${item.addressId}`}
                  className="hover:underline"
                >
                  {item.fullAddress}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
