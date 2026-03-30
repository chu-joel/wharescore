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
}: {
  findings: Finding[];
  addressId: number;
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
      <div className="space-y-2 select-none" aria-hidden>
        {findings.slice(0, 3).map((finding, i) => (
          <BlurredCard key={i} severity={finding.severity} />
        ))}
        {findings.length > 3 && (
          <div className="text-center text-xs text-muted-foreground py-1">
            +{findings.length - 3} more...
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
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background shadow-lg border border-border mb-2 group-hover:scale-110 transition-transform">
          <Lock className="h-4.5 w-4.5 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold">
          {findings.length} more finding{findings.length !== 1 ? 's' : ''}
        </p>
        {(criticalCount > 0 || warningCount > 0) && (
          <p className="text-xs mt-0.5">
            {criticalCount > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                {criticalCount} critical{' '}
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {warningCount} to watch
              </span>
            )}
          </p>
        )}
        <p className="text-xs text-piq-primary font-semibold mt-2 group-hover:underline">
          {isHostedQuick ? 'Upgrade to Full Report' : `Unlock full report — ${isPro ? '$4.99' : '$9.99'}`}
        </p>
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
    <div className={`rounded-xl border-2 ${config.border} ${config.bg} p-4 blur-[3px]`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 ${config.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-3/4 bg-current/10 rounded" />
          <div className="h-3 w-full bg-current/5 rounded" />
          <div className="h-3 w-2/3 bg-current/5 rounded" />
        </div>
      </div>
    </div>
  );
}
