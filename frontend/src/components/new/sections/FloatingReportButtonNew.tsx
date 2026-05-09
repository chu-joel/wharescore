'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef } from 'react';
import { Download, Loader2, ShieldAlert, ExternalLink, BookmarkPlus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { usePdfExport } from '@/hooks/usePdfExport';
import { isConsentBannerVisible } from '@/components/common/AnalyticsConsent';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { usePersonaStore } from '@/stores/personaStore';
import { useReportConfirmStore } from '@/components/property/ReportConfirmModal';

interface Props {
  addressId: number;
  riskCount?: number;
}

/**
 * Floating report CTA. Same logic and portal mounting as classic
 * FloatingReportButton: contextual copy by auth state + risk count, secondary
 * PDF download when interactive report is the primary action, credit badge
 * for paid users.
 */
export function FloatingReportButtonNew({ addressId, riskCount }: Props) {
  const persona = usePersonaStore((s) => s.persona);
  const pdf = usePdfExport(addressId, persona);
  const [mounted, setMounted] = useState(false);
  const [consentUp, setConsentUp] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const credits = useDownloadGateStore((s) => s.credits);
  const isAuthenticated = useDownloadGateStore((s) => s.isAuthenticated);
  const showUpgradeModal = useDownloadGateStore((s) => s.showUpgradeModal);
  const showConfirmModal = useReportConfirmStore((s) => s.open);
  const { status } = useSession();
  const isSignedIn = isAuthenticated || status === 'authenticated';

  useEffect(() => {
    const id = 'floating-report-btn-new';
    let container = document.getElementById(id) as HTMLDivElement | null;
    if (!container) {
      container = document.createElement('div');
      container.id = id;
      // Pull in .ws-new tokens by tagging the portal so dark mode tokens apply.
      container.className = 'ws-new';
      document.body.appendChild(container);
    }
    containerRef.current = container;
    setMounted(true);
    setConsentUp(isConsentBannerVisible());
    const onDismiss = () => setConsentUp(false);
    window.addEventListener('consent-dismissed', onDismiss);
    return () => {
      window.removeEventListener('consent-dismissed', onDismiss);
      if (container && container.childNodes.length === 0) container.remove();
    };
  }, []);

  if (!mounted || !containerRef.current) return null;
  const modalOpen = showUpgradeModal || showConfirmModal;

  const handleClick = () => {
    if (pdf.shareUrl) window.open(pdf.shareUrl, '_blank', 'noopener,noreferrer');
    else if (pdf.downloadUrl) window.open(pdf.downloadUrl, '_blank', 'noopener,noreferrer');
    else if (!pdf.isGenerating) pdf.startExport(isSignedIn ? 'full' : 'quick');
  };

  const handleDownloadPdf = () => {
    if (pdf.downloadUrl) window.open(pdf.downloadUrl, '_blank', 'noopener,noreferrer');
  };

  let ctaText = isSignedIn ? 'Generate Report' : 'Save free report';
  let CtaIcon = isSignedIn ? Download : BookmarkPlus;
  const hasCredits = isSignedIn && credits && credits.plan !== 'free';

  if (!pdf.isGenerating && !pdf.shareUrl && !pdf.downloadUrl) {
    if (riskCount && riskCount >= 3) {
      ctaText = `${riskCount} risks found`;
      CtaIcon = ShieldAlert;
    } else if (riskCount && riskCount >= 1) {
      ctaText = `${riskCount} risk${riskCount > 1 ? 's' : ''} found`;
      CtaIcon = ShieldAlert;
    }
  }

  let creditLabel = '';
  if (credits?.plan === 'pro') {
    const remaining = (credits.dailyLimit ?? 10) - credits.downloadsToday;
    creditLabel = `${remaining} today`;
  } else if (credits?.creditsRemaining != null && credits.creditsRemaining > 0) {
    creditLabel = `${credits.creditsRemaining} credit${credits.creditsRemaining === 1 ? '' : 's'}`;
  }

  const reportReady = !!(pdf.shareUrl || pdf.downloadUrl);
  const bottom = consentUp ? '128px' : '24px';
  const bottomMobile = consentUp ? '128px' : '96px';

  return createPortal(
    <div
      data-tour="generate-report"
      style={{
        position: 'fixed',
        left: 20,
        bottom: `clamp(${bottom}, env(safe-area-inset-bottom, 0) + ${bottomMobile}, ${bottomMobile})`,
        zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 8,
        opacity: modalOpen ? 0.3 : 1,
        pointerEvents: modalOpen ? 'none' : undefined,
        transition: 'opacity 200ms',
      }}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={pdf.isGenerating}
        aria-label={pdf.isGenerating ? 'Generating report' : reportReady ? 'View report' : ctaText}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 20px 12px 16px', borderRadius: 999, border: 0,
          background: 'var(--ws-piq)', color: '#fff',
          boxShadow: '0 8px 20px rgba(13,115,119,.30)',
          cursor: pdf.isGenerating ? 'wait' : 'pointer',
          fontSize: 14, fontWeight: 600,
          minHeight: 44,
        }}
      >
        {pdf.isGenerating ? (
          <><Loader2 size={18} className="animate-spin" /><span>Generating…</span></>
        ) : reportReady ? (
          <><ExternalLink size={18} /><span>View Report</span></>
        ) : (
          <><CtaIcon size={18} /><span>{ctaText}</span></>
        )}
      </button>

      {pdf.shareUrl && pdf.downloadUrl && (
        <button
          type="button"
          onClick={handleDownloadPdf}
          title="Download PDF version"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 999,
            background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(6px)',
            border: '1px solid var(--ws-rule)',
            fontSize: 12, fontWeight: 500, color: 'var(--ws-ink-soft)',
            boxShadow: '0 1px 2px rgba(0,0,0,.06)',
            minHeight: 36, cursor: 'pointer',
          }}
        >
          <Download size={14} />
          PDF
        </button>
      )}

      {hasCredits && creditLabel && !pdf.isGenerating && !reportReady && (
        <span style={{
          padding: '6px 10px', borderRadius: 999,
          background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(6px)',
          border: '1px solid var(--ws-rule)',
          fontSize: 11.5, fontWeight: 500, color: 'var(--ws-ink-soft)',
        }}>
          {creditLabel}
        </span>
      )}
    </div>,
    containerRef.current,
  );
}
