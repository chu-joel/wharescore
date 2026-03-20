'use client';

import { createPortal } from 'react-dom';
import { Download, Loader2, FileCheck, ShieldAlert } from 'lucide-react';
import { usePdfExport } from '@/hooks/usePdfExport';
import { useEffect, useState, useRef } from 'react';
import { useDownloadGateStore } from '@/stores/downloadGateStore';

interface FloatingReportButtonProps {
  addressId: number;
  /** Number of critical+warning findings from the report — drives contextual CTA */
  riskCount?: number;
}

export function FloatingReportButton({ addressId, riskCount }: FloatingReportButtonProps) {
  const pdf = usePdfExport(addressId);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const credits = useDownloadGateStore((s) => s.credits);
  const isAuthenticated = useDownloadGateStore((s) => s.isAuthenticated);

  useEffect(() => {
    const id = 'floating-report-btn';
    let container = document.getElementById(id) as HTMLDivElement | null;
    if (!container) {
      container = document.createElement('div');
      container.id = id;
      document.body.appendChild(container);
    }
    containerRef.current = container;
    setMounted(true);

    return () => {
      if (container && container.childNodes.length === 0) {
        container.remove();
      }
    };
  }, []);

  if (!mounted || !containerRef.current) return null;

  const handleClick = () => {
    if (pdf.downloadUrl) {
      window.open(pdf.downloadUrl, '_blank', 'noopener,noreferrer');
    } else if (!pdf.isGenerating) {
      pdf.startExport();
    }
  };

  // Contextual CTA copy based on report data
  let ctaText = 'Get Full Report';
  let ctaIcon = <Download className="h-5 w-5" />;
  const hasCredits = isAuthenticated && credits && credits.plan !== 'free';

  if (!pdf.isGenerating && !pdf.downloadUrl) {
    if (hasCredits) {
      ctaText = 'Download Report';
    } else if (riskCount && riskCount >= 3) {
      ctaText = `${riskCount} risks — get full report`;
      ctaIcon = <ShieldAlert className="h-5 w-5" />;
    } else if (riskCount && riskCount >= 1) {
      ctaText = `${riskCount} risk${riskCount > 1 ? 's' : ''} — see details`;
      ctaIcon = <ShieldAlert className="h-5 w-5" />;
    }
  }

  // Credit badge for paid users
  let creditLabel = '';
  if (credits?.plan === 'pro') {
    const remaining = (credits.dailyLimit ?? 10) - credits.downloadsToday;
    creditLabel = `${remaining} today`;
  } else if (credits?.creditsRemaining !== null && credits?.creditsRemaining !== undefined && credits.creditsRemaining > 0) {
    creditLabel = `${credits.creditsRemaining} credit${credits.creditsRemaining === 1 ? '' : 's'}`;
  }

  return createPortal(
    <div className="fixed bottom-5 left-5 z-[9999] flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={pdf.isGenerating}
        className="flex items-center gap-2 rounded-full bg-piq-primary text-white pl-4 pr-5 py-3 shadow-lg shadow-piq-primary/25 hover:bg-piq-primary-dark transition-all duration-200 hover:shadow-xl hover:shadow-piq-primary/30 active:scale-95 disabled:opacity-80 disabled:cursor-wait"
        aria-label={pdf.isGenerating ? 'Generating report' : pdf.downloadUrl ? 'Open report' : ctaText}
      >
        {pdf.isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-semibold">Generating...</span>
          </>
        ) : pdf.downloadUrl ? (
          <>
            <FileCheck className="h-5 w-5" />
            <span className="text-sm font-semibold">Open Report</span>
          </>
        ) : (
          <>
            {ctaIcon}
            <span className="text-sm font-semibold">{ctaText}</span>
          </>
        )}
      </button>
      {hasCredits && creditLabel && !pdf.isGenerating && !pdf.downloadUrl && (
        <span className="rounded-full bg-background/90 backdrop-blur-sm border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          {creditLabel}
        </span>
      )}
    </div>,
    containerRef.current,
  );
}
