'use client';

import { Gift } from 'lucide-react';

export function BetaBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-piq-primary/15 bg-piq-primary/5 dark:bg-piq-primary/10 px-4 py-3">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-piq-primary/10 shrink-0">
        <Gift className="h-3.5 w-3.5 text-piq-primary" />
      </div>
      <p className="text-xs">
        <span className="font-semibold text-piq-primary">Full reports are free during beta.</span>{' '}
        <span className="text-muted-foreground">Launching at $15/report later this year.</span>
      </p>
    </div>
  );
}
