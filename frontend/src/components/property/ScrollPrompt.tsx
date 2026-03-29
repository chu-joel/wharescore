'use client';

import { useEffect, useState, useRef } from 'react';
import { X, ShieldAlert, TrendingUp } from 'lucide-react';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { shouldShowScrollPrompt, markScrollPromptShown } from '@/hooks/useVisitTracker';
import type { PropertyReport } from '@/lib/types';
import { generateFindings, type Finding } from './FindingCard';

interface ScrollPromptProps {
  report: PropertyReport;
}

type PromptVariant = {
  icon: typeof ShieldAlert;
  iconColor: string;
  message: string;
  cta: string;
};

/**
 * Scroll-triggered contextual upgrade prompt.
 * Shows after 75% scroll depth + 5s delay, OR after 90s regardless of scroll.
 * Positioned above the floating report button to avoid overlap.
 */
export function ScrollPrompt({ report }: ScrollPromptProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const setShowUpgradeModal = useDownloadGateStore((s) => s.setShowUpgradeModal);
  const canDownload = useDownloadGateStore((s) => s.canDownload);
  const triggeredRef = useRef(false);

  const { allowed } = canDownload();

  useEffect(() => {
    if (allowed || dismissed || !shouldShowScrollPrompt()) return;

    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      if (triggeredRef.current) return;
      const scrollPercent =
        (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (scrollPercent >= 0.90) {
        triggeredRef.current = true;
        scrollTimer = setTimeout(() => {
          markScrollPromptShown();
          setVisible(true);
        }, 15000);
      }
    };

    // Fallback: show after 3 min even if user hasn't scrolled deep enough
    const fallbackTimer = setTimeout(() => {
      if (!triggeredRef.current) {
        triggeredRef.current = true;
        markScrollPromptShown();
        setVisible(true);
      }
    }, 180000);

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(fallbackTimer);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [allowed, dismissed]);

  if (!visible || dismissed || allowed) return null;

  const variant = getPromptVariant(report);

  return (
    <div className="fixed bottom-[4.5rem] right-4 left-4 z-[9990] animate-in slide-in-from-bottom-4 duration-500 sm:left-auto sm:max-w-sm">
      <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-xl p-4">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Dismiss promotion"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-piq-primary/10 shrink-0">
            <variant.icon className={`h-4.5 w-4.5 ${variant.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-semibold leading-snug">{variant.message}</p>
            <button
              onClick={() => {
                setDismissed(true);
                setShowUpgradeModal(true, 'risk');
              }}
              className="text-xs font-semibold text-piq-primary hover:underline mt-1.5"
            >
              {variant.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getPromptVariant(report: PropertyReport): PromptVariant {
  const findings = generateFindings(report);
  const criticalCount = findings.filter((f: Finding) => f.severity === 'critical').length;
  const warningCount = findings.filter((f: Finding) => f.severity === 'warning').length;
  const totalRisks = criticalCount + warningCount;

  if (totalRisks >= 3) {
    return {
      icon: ShieldAlert,
      iconColor: 'text-red-500',
      message: `${totalRisks} risk findings affect this property. See the full hazard analysis.`,
      cta: 'Unlock full report — $9.99',
    };
  }

  if (totalRisks >= 1) {
    return {
      icon: ShieldAlert,
      iconColor: 'text-amber-500',
      message: `${totalRisks} finding${totalRisks > 1 ? 's' : ''} to review before making a decision.`,
      cta: 'Get the complete analysis — $9.99',
    };
  }

  return {
    icon: TrendingUp,
    iconColor: 'text-piq-primary',
    message: 'Get the full 27-indicator analysis with AI insights and personalised recommendations.',
    cta: 'Download full report — $9.99',
  };
}
