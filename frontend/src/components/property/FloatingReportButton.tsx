'use client';

import { createPortal } from 'react-dom';
import { Download, Loader2, FileCheck, ShieldAlert, ExternalLink, BookmarkPlus } from 'lucide-react';
import { usePdfExport } from '@/hooks/usePdfExport';
import { useEffect, useState, useRef } from 'react';
import { isConsentBannerVisible } from '@/components/common/AnalyticsConsent';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { usePersonaStore } from '@/stores/personaStore';
import { useReportConfirmStore } from './ReportConfirmModal';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface FloatingReportButtonProps {
  addressId: number;
  /** Number of critical+warning findings from the report — drives contextual CTA */
  riskCount?: number;
}

export function FloatingReportButton({ addressId, riskCount }: FloatingReportButtonProps) {
  const persona = usePersonaStore((s) => s.persona);
  const pdf = usePdfExport(addressId, persona);
  const [mounted, setMounted] = useState(false);
  const [consentUp, setConsentUp] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const credits = useDownloadGateStore((s) => s.credits);
  const isAuthenticated = useDownloadGateStore((s) => s.isAuthenticated);
  const showUpgradeModal = useDownloadGateStore((s) => s.showUpgradeModal);
  const showConfirmModal = useReportConfirmStore((s) => s.open);
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const isSignedIn = isAuthenticated || sessionStatus === 'authenticated';

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
    setConsentUp(isConsentBannerVisible());

    const onDismiss = () => setConsentUp(false);
    window.addEventListener('consent-dismissed', onDismiss);
    return () => {
      window.removeEventListener('consent-dismissed', onDismiss);
      if (container && container.childNodes.length === 0) {
        container.remove();
      }
    };
  }, []);

  if (!mounted || !containerRef.current) return null;
  const modalOpen = showUpgradeModal || showConfirmModal;

  const handleClick = () => {
    if (pdf.shareUrl) {
      // Open interactive report in new tab
      window.open(pdf.shareUrl, '_blank', 'noopener,noreferrer');
    } else if (pdf.downloadUrl) {
      window.open(pdf.downloadUrl, '_blank', 'noopener,noreferrer');
    } else if (!pdf.isGenerating) {
      // Unauth → low-friction "quick" path (Google sign-in → auto Quick
      // Report). Auth → normal flow with tier selector in confirm modal.
      pdf.startExport(isSignedIn ? undefined : 'quick');
    }
  };

  const handleDownloadPdf = () => {
    if (pdf.downloadUrl) {
      window.open(pdf.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Contextual CTA copy based on auth state and report data.
  //   - Unauth: primary action is "Save free report" (one-tap Google sign-in).
  //   - Auth  : primary action is "Generate Report" (confirm modal picks tier).
  // We still surface the risk count in place of the generic label when the
  // report actually has critical/warning findings — users notice "3 risks
  // found" more than a neutral CTA, so we let urgency override the verb.
  let ctaText = isSignedIn ? 'Generate Report' : 'Save free report';
  let ctaIcon: React.ReactNode = isSignedIn
    ? <Download className="h-5 w-5" />
    : <BookmarkPlus className="h-5 w-5" />;
  const hasCredits = isSignedIn && credits && credits.plan !== 'free';

  if (!pdf.isGenerating && !pdf.shareUrl && !pdf.downloadUrl) {
    if (riskCount && riskCount >= 3) {
      ctaText = `${riskCount} risks found`;
      ctaIcon = <ShieldAlert className="h-5 w-5" />;
    } else if (riskCount && riskCount >= 1) {
      ctaText = `${riskCount} risk${riskCount > 1 ? 's' : ''} found`;
      ctaIcon = <ShieldAlert className="h-5 w-5" />;
    } else if (hasCredits) {
      ctaText = 'Generate Report';
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
    <div className={`fixed left-5 pb-[env(safe-area-inset-bottom)] z-[9999] flex items-center gap-2 transition-all duration-200 ${modalOpen ? 'opacity-30 pointer-events-none' : ''} ${consentUp ? 'bottom-16' : 'bottom-5'}`}>
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
            <ExternalLink className="h-5 w-5" />
            <span className="text-sm font-semibold">View Report</span>
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
