'use client';

import { useState } from 'react';
import { ArrowLeft, Share2, Printer } from 'lucide-react';
import Link from 'next/link';
import type { ReportSnapshot } from '@/lib/types';
import { HostedHeroCardNew } from '@/components/new/sections/HostedHeroCardNew';

interface Props {
  snapshot: ReportSnapshot;
  token: string;
  variant: 'quick' | 'full';
  children: React.ReactNode;
}

/**
 * Shell for /new/report/[token]. Renders new sticky header + new cover hero
 * above the wrapped classic HostedReport / HostedQuickReport body. The
 * classic body's own sticky header is hidden via tokens-new.css.
 */
export function HostedReportShell({ snapshot, token, variant, children }: Props) {
  void token;
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Property Report. ${snapshot.meta.full_address}`, url });
      } catch { /* cancel */ }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* New sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 56,
        borderBottom: '1px solid var(--ws-rule)',
        background: 'color-mix(in oklab, var(--ws-surface) 92%, transparent)',
        backdropFilter: 'saturate(140%) blur(8px)',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center', padding: '0 16px', gap: 16,
      }}
        className="hosted-report-new-header"
      >
        <Link href="/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--ws-piq)', fontWeight: 600, fontSize: 14,
          textDecoration: 'none', minHeight: 44,
        }}>
          <ArrowLeft size={14} />
          WhareScore
        </Link>
        <span style={{
          fontSize: 12, color: 'var(--ws-ink-mute)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} className="hidden-mobile">
          {snapshot.meta.full_address}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleShare}
            className="ws-btn ws-btn-ghost"
            style={{ minHeight: 40 }}
            title="Copy link to clipboard"
          >
            <Share2 size={14} />
            <span>{copied ? 'Copied!' : 'Share'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="ws-btn ws-btn-primary"
            style={{ minHeight: 40 }}
            title="Print or save as PDF"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </header>

      {/* A8-style hero card — title, score ring, stat grid + property image */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px 8px' }}>
        <HostedHeroCardNew snapshot={snapshot} variant={variant} />
      </section>

      {/* Wrapped classic body — header + cover hidden via CSS in tokens-new.css */}
      <div data-ws-new-wrapper="hosted-body">
        {children}
      </div>
    </>
  );
}
