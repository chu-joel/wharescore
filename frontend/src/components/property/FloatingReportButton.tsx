'use client';

import { createPortal } from 'react-dom';
import { Download, Loader2, FileCheck, ShieldAlert, ExternalLink } from 'lucide-react';
import { usePdfExport } from '@/hooks/usePdfExport';
import { useEffect, useState, useRef } from 'react';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { usePersonaStore } from '@/stores/personaStore';
import { useRouter } from 'next/navigation';

interface FloatingReportButtonProps {
  addressId: number;
  /** Number of critical+warning findings from the report — drives contextual CTA */
  riskCount?: number;
}

export function FloatingReportButton({ addressId, riskCount }: FloatingReportButtonProps) {
  const persona = usePersonaStore((s) => s.persona);
  const pdf = usePdfExport(addressId, persona);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const credits = useDownloadGateStore((s) => s.credits);
  const isAuthenticated = useDownloadGateStore((s) => s.isAuthenticated);
  const showUpgradeModal = useDownloadGateStore((s) => s.showUpgradeModal);

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

  if (!mounted || !containerRef.current || showUpgradeModal) return null;

  const router = useRouter();

  const handleClick = () => {
    if (pdf.shareUrl) {
      // Open interactive report in new tab
      window.open(pdf.shareUrl, '_blank', 'noopener,noreferrer');
    } else if (pdf.downloadUrl) {
      window.open(pdf.downloadUrl, '_blank', 'noopener,noreferrer');
    } else if (!pdf.isGenerating) {
      pdf.startExport();
    }
  };

  const handleDownloadPdf = () => {
    if (pdf.downloadUrl) {
      window.open(pdf.downloadUrl, '_blank', 'noopener,noreferrer');
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

  const reportReady = !!(pdf.shareUrl || pdf.downloadUrl);

  return createPortal(
    <div className="fixed bottom-5 left-5 z-[9999] flex items-center gap-2">
      {/* Primary button */}
      <button
        onClick={handleClick}
        disabled={pdf.isGenerating}
        className="flex items-center gap-2 rounded-full bg-piq-primary text-white pl-4 pr-5 py-3 shadow-lg shadow-piq-primary/25 hover:bg-piq-primary-dark transition-all duration-200 hover:shadow-xl hover:shadow-piq-primary/30 active:scale-95 disabled:opacity-80 disabled:cursor-wait"
        aria-label={pdf.isGenerating ? 'Generating report' : reportReady ? 'View report' : ctaText}
      >
        {pdf.isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-semibold">Generating...</span>
          </>
        ) : pdf.shareUrl ? (
          <>
            <ExternalLink className="h-5 w-5" />
            <span className="text-sm font-semibold">View Report</span>
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
      {/* Secondary: PDF download when interactive report is primary */}
      {pdf.shareUrl && pdf.downloadUrl && (
        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur-sm border border-border px-3 py-2 shadow-sm hover:bg-muted transition-colors"
          title="Download PDF version"
        >
          <Download className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">PDF</span>
        </button>
      )}
      {hasCredits && creditLabel && !pdf.isGenerating && !reportReady && (
        <span className="rounded-full bg-background/90 backdrop-blur-sm border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          {creditLabel}
        </span>
      )}
    </div>,
    containerRef.current,
  );
}
