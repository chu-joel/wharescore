'use client';

import { Shield } from 'lucide-react';
import { useSession } from 'next-auth/react';

export function BetaBanner() {
  // Hide the "sign in" prompt for users who are already signed in — it was
  // showing up as nagging dead space for logged-in visitors.
  const { status } = useSession();
  if (status === 'authenticated') return null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-piq-primary/15 bg-piq-primary/5 dark:bg-piq-primary/10 px-4 py-3">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-piq-primary/10 shrink-0">
        <Shield className="h-3.5 w-3.5 text-piq-primary" />
      </div>
      <p className="text-xs">
        <span className="font-semibold text-piq-primary">Free property report — sign in for the full version</span>
      </p>
    </div>
  );
}
