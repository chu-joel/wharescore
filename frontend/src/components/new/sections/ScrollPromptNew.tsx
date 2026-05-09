'use client';

import { useEffect, useState, useRef } from 'react';
import { X, ShieldAlert, TrendingUp } from 'lucide-react';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { shouldShowScrollPrompt, markScrollPromptShown } from '@/hooks/useVisitTracker';
import type { PropertyReport } from '@/lib/types';
import { generateFindings, type Finding } from '@/components/property/FindingCard';

interface PromptVariant {
  Icon: typeof ShieldAlert;
  iconColor: string;
  message: string;
  cta: string;
}

/**
 * Scroll-triggered upgrade prompt. Same trigger logic as classic ScrollPrompt
 * (90% scroll + 15s, fallback at 3 min). Layered above FloatingReportButton.
 */
export function ScrollPromptNew({ report }: { report: PropertyReport }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const setShowUpgradeModal = useDownloadGateStore((s) => s.setShowUpgradeModal);
  const canDownload = useDownloadGateStore((s) => s.canDownload);
  const triggeredRef = useRef(false);
  const { allowed } = canDownload();

  useEffect(() => {
    if (allowed || dismissed || !shouldShowScrollPrompt()) return;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      if (triggeredRef.current) return;
      const pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (pct >= 0.90) {
        triggeredRef.current = true;
        scrollTimer = setTimeout(() => {
          markScrollPromptShown();
          setVisible(true);
        }, 15000);
      }
    };
    const fallback = setTimeout(() => {
      if (!triggeredRef.current) {
        triggeredRef.current = true;
        markScrollPromptShown();
        setVisible(true);
      }
    }, 180000);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(fallback);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [allowed, dismissed]);

  if (!visible || dismissed || allowed) return null;

  const variant = getVariant(report, '$2.99');
  const Icon = variant.Icon;

  return (
    <div
      style={{
        position: 'fixed', zIndex: 9990,
        bottom: '4.5rem', right: 16, left: 16,
        maxWidth: 'min(384px, calc(100vw - 32px))',
        marginLeft: 'auto',
        animation: 'wsSlideUp 500ms cubic-bezier(.22,1,.36,1) both',
      }}
    >
      <div style={{
        position: 'relative',
        background: 'color-mix(in oklab, var(--ws-surface) 95%, transparent)',
        backdropFilter: 'saturate(140%) blur(8px)',
        border: '1px solid var(--ws-rule)',
        borderRadius: 'var(--ws-radius)',
        padding: 14,
        boxShadow: 'var(--ws-shadow-lg)',
      }}>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss promotion"
          style={{
            position: 'absolute', top: 6, right: 6,
            width: 28, height: 28, borderRadius: 999,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 0, cursor: 'pointer',
            color: 'var(--ws-ink-mute)',
          }}
        >
          <X size={14} />
        </button>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingRight: 22 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'rgba(13,115,119,.12)', color: variant.iconColor,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <Icon size={16} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)', lineHeight: 1.35 }}>
              {variant.message}
            </p>
            <button
              type="button"
              onClick={() => { setDismissed(true); setShowUpgradeModal(true, 'risk'); }}
              style={{
                background: 'transparent', border: 0, padding: '6px 0 0', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: 'var(--ws-piq-dark)',
                textDecoration: 'underline', textUnderlineOffset: 2,
              }}
            >
              {variant.cta}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes wsSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ws-scrollprompt] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function getVariant(report: PropertyReport, price: string): PromptVariant {
  const findings = generateFindings(report);
  const crit = findings.filter((f: Finding) => f.severity === 'critical').length;
  const warn = findings.filter((f: Finding) => f.severity === 'warning').length;
  const total = crit + warn;
  if (total >= 3) {
    return {
      Icon: ShieldAlert,
      iconColor: 'var(--ws-r-vhigh)',
      message: `${total} risk findings affect this property. See the full hazard analysis.`,
      cta: `Unlock full report. ${price}`,
    };
  }
  if (total >= 1) {
    return {
      Icon: ShieldAlert,
      iconColor: 'var(--ws-r-high)',
      message: `${total} finding${total > 1 ? 's' : ''} to review before making a decision.`,
      cta: `Get the complete analysis. ${price}`,
    };
  }
  return {
    Icon: TrendingUp,
    iconColor: 'var(--ws-piq)',
    message: 'Get the full 40+ risk-check analysis with AI insights and personalised recommendations.',
    cta: `Download full report. ${price}`,
  };
}
