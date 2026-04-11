'use client';

import { Lock, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { Finding } from './FindingCard';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { useHostedReport } from '@/components/report/HostedReportContext';

/**
 * Shows blurred/ghosted versions of hidden findings.
 * The blur is transparent enough to see severity colors but not text —
 * creating Zeigarnik tension ("I can see red badges but can't read them").
 */
export function BlurredFindingCards({
  findings,
  addressId,
  totalCount,
}: {
  findings: Finding[];
  addressId: number;
  /** Total finding count (hidden + shown). Used so the CTA always shows the correct grand total. */
  totalCount: number;
}) {
  const hosted = useHostedReport();
  // Hide blurred cards on Full hosted reports (user has paid for all findings)
  // Show them on Quick hosted reports (teaser for upgrade)
  if (hosted && hosted.snapshot.report_tier !== 'quick') return null;
  const isHostedQuick = !!hosted && hosted.snapshot.report_tier === 'quick';
  const setShowUpgradeModal = useDownloadGateStore((s) => s.setShowUpgradeModal);
  const isPro = useDownloadGateStore((s) => s.credits?.plan === 'pro');

  if (findings.length === 0) return null;

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;

  return (
    <div className="relative">
      {/* Blurred ghost cards — show severity colors but not text */}
      <div className="space-y-1.5 select-none" aria-hidden>
        {findings.slice(0, 2).map((finding, i) => (
          <BlurredCard key={i} severity={finding.severity} />
        ))}
        {findings.length > 2 && (
          <div className="text-center text-xs text-muted-foreground py-0.5">
            +{findings.length - 2} more...
          </div>
        )}
      </div>

      {/* Overlay — the conversion point */}
      <button
        onClick={() => {
          if (isHostedQuick) {
            document.getElementById('upgrade-banner')?.scrollIntoView({ behavior: 'smooth' });
          } else {
            setShowUpgradeModal(true, 'risk', { riskCount: criticalCount + warningCount });
          }
        }}
        className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl cursor-pointer hover:bg-background/50 transition-colors group"
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-background shadow-lg border border-border mb-2 group-hover:scale-110 transition-transform">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold">
          {findings.length} more finding{findings.length !== 1 ? 's' : ''}
        </p>
        {(criticalCount > 0 || warningCount > 0) && (
          <p className="text-xs mt-0.5">
            Including{' '}
            {criticalCount > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                {criticalCount} critical
              </span>
            )}
            {criticalCount > 0 && warningCount > 0 && <span> and </span>}
            {warningCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {warningCount} to watch
              </span>
            )}
          </p>
        )}
        <p className="text-xs text-piq-primary font-semibold mt-2 group-hover:underline">
          {isHostedQuick ? 'Upgrade to Full Report' : `See all ${totalCount} findings`}
        </p>
        {!isHostedQuick && (
          <p className="text-[10px] text-muted-foreground mt-0.5">In the full report</p>
        )}
      </button>
    </div>
  );
}

function BlurredCard({ severity }: { severity: Finding['severity'] }) {
  const config = {
    critical: {
      border: 'border-red-500/40',
      bg: 'bg-red-50/60 dark:bg-red-950/20',
      icon: AlertTriangle,
      iconColor: 'text-red-400',
    },
    warning: {
      border: 'border-amber-500/40',
      bg: 'bg-amber-50/60 dark:bg-amber-950/20',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
    },
    info: {
      border: 'border-blue-500/40',
      bg: 'bg-blue-50/60 dark:bg-blue-950/20',
      icon: Info,
      iconColor: 'text-blue-400',
    },
    positive: {
      border: 'border-green-500/40',
      bg: 'bg-green-50/60 dark:bg-green-950/20',
      icon: CheckCircle2,
      iconColor: 'text-green-400',
    },
  }[severity];

  const Icon = config.icon;

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} p-2.5 blur-[3px]`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${config.iconColor} shrink-0`} />
        <div className="flex-1 space-y-1">
          <div className="h-3 w-3/4 bg-current/10 rounded" />
          <div className="h-2.5 w-1/2 bg-current/5 rounded" />
        </div>
      </div>
    </div>
  );
}
