'use client';

import { Sparkles } from 'lucide-react';

interface Props {
  token: string;
}

export function QuickUpgradeBanner({ token }: Props) {
  return (
    <div className="rounded-xl border-2 border-piq-primary/30 bg-gradient-to-r from-piq-primary/5 to-piq-primary/10 p-6 text-center space-y-3">
      <div className="flex justify-center">
        <div className="h-10 w-10 rounded-full bg-piq-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-piq-primary" />
        </div>
      </div>
      <h3 className="text-lg font-bold">Want the full picture?</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Upgrade to the Full Report for detailed hazard intelligence, rent/price methodology,
        neighbourhood deep-dive, terrain analysis, and 25+ sections of property data.
      </p>
      <button
        onClick={() => {
          // TODO: Wire to upgrade checkout endpoint POST /report/{token}/upgrade
          window.alert('Upgrade flow coming soon — this will create a Stripe checkout for $5.00');
        }}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-piq-primary text-white text-sm font-semibold hover:bg-piq-primary/90 transition-colors"
      >
        <Sparkles className="h-4 w-4" />
        Upgrade for $5.00
      </button>
    </div>
  );
}
