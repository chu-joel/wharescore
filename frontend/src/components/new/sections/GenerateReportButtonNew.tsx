'use client';

import { Download, Loader2, ShieldAlert, ExternalLink, BookmarkPlus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { usePdfExport } from '@/hooks/usePdfExport';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { usePersonaStore } from '@/stores/personaStore';

interface Props {
  addressId: number;
  riskCount?: number;
}

/**
 * Inline Generate Report CTA — replaces the bottom-left floating
 * "N risks found" portal that hovered over the map. Sits inside the
 * report panel header (HeroBlockNew action row), mirroring the
 * "Get full report" button placement in design-experiments/A6-balanced.html.
 *
 * Same logic as FloatingReportButtonNew (contextual copy by auth + risk
 * count, share / download once generated) but rendered inline as a
 * regular button instead of a fixed-position portal.
 */
export function GenerateReportButtonNew({ addressId, riskCount }: Props) {
  const persona = usePersonaStore((s) => s.persona);
  const pdf = usePdfExport(addressId, persona);
  const credits = useDownloadGateStore((s) => s.credits);
  const isAuthenticated = useDownloadGateStore((s) => s.isAuthenticated);
  const { status } = useSession();
  const isSignedIn = isAuthenticated || status === 'authenticated';

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

  if (!pdf.isGenerating && !pdf.shareUrl && !pdf.downloadUrl && riskCount && riskCount >= 1) {
    ctaText = `${riskCount} risk${riskCount > 1 ? 's' : ''} found`;
    CtaIcon = ShieldAlert;
  }

  let creditLabel = '';
  if (credits?.plan === 'pro') {
    const remaining = (credits.dailyLimit ?? 10) - credits.downloadsToday;
    creditLabel = `${remaining} today`;
  } else if (credits?.creditsRemaining != null && credits.creditsRemaining > 0) {
    creditLabel = `${credits.creditsRemaining} credit${credits.creditsRemaining === 1 ? '' : 's'}`;
  }

  const reportReady = !!(pdf.shareUrl || pdf.downloadUrl);

  return (
    <div
      data-tour="generate-report"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={pdf.isGenerating}
        aria-label={pdf.isGenerating ? 'Generating report' : reportReady ? 'View report' : ctaText}
        className="ws-btn ws-btn-primary"
        style={{ minHeight: 40, padding: '0 16px', fontSize: 13, fontWeight: 600 }}
      >
        {pdf.isGenerating ? (
          <><Loader2 size={15} className="animate-spin" /><span>Generating&hellip;</span></>
        ) : reportReady ? (
          <><ExternalLink size={15} /><span>View Report</span></>
        ) : (
          <><CtaIcon size={15} /><span>{ctaText}</span></>
        )}
      </button>

      {pdf.shareUrl && pdf.downloadUrl && (
        <button
          type="button"
          onClick={handleDownloadPdf}
          title="Download PDF version"
          className="ws-btn ws-btn-outline"
          style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }}
        >
          <Download size={13} /> PDF
        </button>
      )}

      {hasCredits && creditLabel && !pdf.isGenerating && !reportReady && (
        <span style={{
          padding: '4px 10px', borderRadius: 999,
          background: 'var(--ws-bg-2)', border: '1px solid var(--ws-rule)',
          fontSize: 11.5, fontWeight: 500, color: 'var(--ws-ink-soft)',
        }}>
          {creditLabel}
        </span>
      )}
    </div>
  );
}
