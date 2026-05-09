'use client';

import { useState } from 'react';
import { ArrowLeft, Share2, Printer, Home, TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';
import type { ReportSnapshot } from '@/lib/types';
import { transformReport } from '@/lib/transformReport';
import { getRatingBin } from '@/lib/constants';
import { formatCurrency, effectivePerUnitCv, resolveFloorArea } from '@/lib/format';

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

  const report = transformReport(
    snapshot.report,
    (snapshot as unknown as { rates_data?: unknown }).rates_data,
  );
  const persona = snapshot.meta.persona;
  const hasScore = Number.isFinite(report.scores?.overall);
  const bin = hasScore ? getRatingBin(report.scores.overall) : null;

  const cv = effectivePerUnitCv(report.property.capital_value, {
    isMultiUnit: !!report.property_detection?.is_multi_unit,
    unitCount: report.property_detection?.unit_count,
  });
  const floor = resolveFloorArea(report.property, {
    isMultiUnit: !!report.property_detection?.is_multi_unit,
    titleType: report.property.title_type,
  });
  const rawProp = (snapshot.report?.property ?? {}) as Record<string, unknown>;
  const titleType = rawProp.title_type as string | undefined;
  const buildingUse = rawProp.building_use as string | undefined;
  const propertyType =
    (titleType && titleType !== 'Unknown' ? titleType : null) ||
    (buildingUse && buildingUse !== 'Unknown' ? buildingUse : null);

  const generatedDate = new Date(snapshot.meta.generated_at).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

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

      {/* New cover */}
      <section style={{
        maxWidth: 760, margin: '0 auto', padding: '40px 24px 24px',
        textAlign: 'center', display: 'grid', gap: 14,
      }}>
        <div style={{
          display: 'inline-flex', alignSelf: 'center', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 999,
          background: 'rgba(13,115,119,.10)', color: 'var(--ws-piq-dark)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {persona === 'renter' ? <Home size={12} /> : <TrendingUp size={12} />}
          {variant === 'quick' ? 'Quick Report' : 'Full Report'} · {persona === 'renter' ? 'Renter' : 'Buyer'}
        </div>

        <h1 style={{
          margin: 0,
          fontSize: 'clamp(26px, 4.4vw, 36px)', fontWeight: 800,
          letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--ws-ink)',
          wordBreak: 'break-word',
        }}>
          {snapshot.meta.full_address}
        </h1>

        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ws-ink-soft)' }}>
          {snapshot.meta.sa2_name} · {snapshot.meta.ta_name}
        </p>

        {hasScore && bin && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 999,
              background: bin.color, color: 'oklch(0.18 0.04 70)',
              fontWeight: 700, fontSize: 14,
            }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {report.scores.overall.toFixed(1)}
              </span>
              <small style={{ fontSize: 11, opacity: 0.75 }}>/100</small>
              <span style={{ marginLeft: 6 }}>{bin.label}</span>
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingTop: 4 }}>
          {propertyType && (
            <Pill tone="brand">{propertyType}</Pill>
          )}
          {cv && (
            <Pill>Valuation {formatCurrency(cv)}</Pill>
          )}
          {floor && (
            <Pill>{floor.label} {floor.value.toLocaleString()} m²</Pill>
          )}
          {report.coverage && (
            <Pill>{report.coverage.available} sources checked</Pill>
          )}
          {snapshot.terrain?.elevation_m != null && (
            <Pill>{snapshot.terrain.elevation_m.toFixed(0)} m elevation</Pill>
          )}
        </div>

        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          <Calendar size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
          Generated {generatedDate}
        </p>
      </section>

      {/* Wrapped classic body — header + cover hidden via CSS in tokens-new.css */}
      <div data-ws-new-wrapper="hosted-body">
        {children}
      </div>
    </>
  );
}

function Pill({ tone, children }: { tone?: 'brand'; children: React.ReactNode }) {
  const isBrand = tone === 'brand';
  return (
    <span style={{
      padding: '5px 12px', borderRadius: 'var(--ws-radius-sm)',
      background: isBrand ? 'rgba(13,115,119,.10)' : 'var(--ws-bg-2)',
      border: `1px solid ${isBrand ? 'rgba(13,115,119,.20)' : 'var(--ws-rule)'}`,
      color: isBrand ? 'var(--ws-piq-dark)' : 'var(--ws-ink)',
      fontSize: 12, fontWeight: 500,
    }}>
      {children}
    </span>
  );
}
