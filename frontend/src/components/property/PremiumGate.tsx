'use client';

import { Lock } from 'lucide-react';
import { useDownloadGateStore, type ModalTrigger } from '@/stores/downloadGateStore';
import { useHostedReport } from '@/components/report/HostedReportContext';

interface PremiumGateProps {
  children: React.ReactNode;
  /** Label shown on the lock overlay */
  label?: string;
  /** Trigger context for the upgrade modal */
  trigger?: ModalTrigger;
  /** Extra context passed to modal */
  context?: Record<string, number | string>;
}

/**
 * Wraps premium content — renders children with a blur overlay + lock icon.
 * Clicking the overlay opens the upgrade modal.
 *
 * Usage: <PremiumGate label="Commute times"><TransportTimes .../></PremiumGate>
 */
export function PremiumGate({
  children,
  label = 'Premium feature',
  trigger = 'default',
  context = {},
}: PremiumGateProps) {
  const hosted = useHostedReport();
  const setShowUpgradeModal = useDownloadGateStore((s) => s.setShowUpgradeModal);
  const isPro = useDownloadGateStore((s) => s.credits?.plan === 'pro');

  // In hosted report mode, user has paid — show content ungated
  if (hosted) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Render blurred content at fixed height — teases structure without wasting space */}
      <div className="select-none pointer-events-none max-h-24 overflow-hidden" aria-hidden>
        <div className="blur-[6px] opacity-40">
          {children}
        </div>
      </div>

      {/* Clickable overlay */}
      <button
        onClick={() => setShowUpgradeModal(true, trigger, context)}
        className="absolute inset-0 flex items-center justify-center gap-3 bg-background/60 backdrop-blur-[2px] rounded-xl cursor-pointer hover:bg-background/50 transition-colors group"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background shadow-md border border-border group-hover:scale-110 transition-transform shrink-0">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">{label}</p>
          <p className="text-xs text-piq-primary font-semibold group-hover:underline">
            {isPro ? 'Unlock with 1 credit' : 'Unlock in full report'}
          </p>
        </div>
      </button>
    </div>
  );
}
