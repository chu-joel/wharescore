'use client';

import { Gift } from 'lucide-react';

export function BetaBanner() {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-piq-primary/5 px-4 py-2.5">
      <Gift className="h-4 w-4 text-piq-primary shrink-0" />
      <p className="text-xs text-piq-primary">
        <span className="font-medium">Full reports are free during beta.</span>{' '}
        Launching at $15/report later this year.
      </p>
    </div>
  );
}
