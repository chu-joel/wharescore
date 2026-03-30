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
      {/* Render the actual content but blurred — teases structure/colors */}
      <div className="select-none pointer-events-none" aria-hidden>
        <div className="blur-[8px] opacity-50">
          {children}
        </div>
      </div>

      {/* Clickable overlay */}
      <button
        onClick={() => setShowUpgradeModal(true, trigger, context)}
        className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-[2px] rounded-xl cursor-pointer hover:bg-background/40 transition-colors group"
      >
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-background shadow-lg border border-border mb-1.5 group-hover:scale-110 transition-transform">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs font-bold text-foreground">{label}</p>
        <p className="text-[10px] text-piq-primary font-semibold mt-1 group-hover:underline">
          Unlock — {isPro ? '$4.99' : '$9.99'}
        </p>
      </button>
    </div>
  );
}
