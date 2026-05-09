'use client';

import { AlertTriangle, CheckCircle2, Share2, Search } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { formatCoverage } from '@/lib/format';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface Props {
  report: PropertyReport;
  onSearchAnother: () => void;
}

function ratingLabel(score: number): string {
  if (score <= 20) return 'Low';
  if (score <= 40) return 'Low-Moderate';
  if (score <= 60) return 'Moderate';
  if (score <= 80) return 'High';
  return 'Very High';
}

/**
 * Things to investigate / look good — pulled from indicator scores.
 * Same thresholds as classic KeyTakeaways (>=60 concern, <=20 positive).
 */
export function KeyTakeawaysNew({ report, onSearchAnother }: Props) {
  const cats = Array.isArray(report.scores?.categories) ? report.scores.categories : [];
  const all = cats.flatMap((c) => c.indicators ?? []);
  const hasInds = all.some((i) => i.is_available);

  const concerns = all
    .filter((i) => i.is_available && i.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const positives = all
    .filter((i) => i.is_available && i.score <= 20)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const score = Number.isFinite(report.scores.overall) ? Math.round(report.scores.overall) : '—';
    const text = `WhareScore report for ${report.address.full_address}. Score: ${score}/100`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'WhareScore Report', text, url }); } catch { /* cancel */ }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <Card>
      <CardHead title="Takeaways" meta={hasInds ? `${all.length} indicators` : 'Pending'} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 12 }}>
        {hasInds ? (
          <>
            {concerns.length > 0 ? (
              <div style={{
                borderRadius: 'var(--ws-radius)',
                border: '1px solid var(--ws-rule)',
                padding: 12,
                background: 'rgba(196,45,45,.04)',
              }}>
                <p style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)' }}>
                  {concerns.length} {concerns.length === 1 ? 'thing' : 'things'} to investigate
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                  {concerns.map((ind) => (
                    <li key={ind.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                      <AlertTriangle size={14} style={{ color: 'var(--ws-r-vhigh)', marginTop: 2, flexShrink: 0 }} />
                      <span>
                        <span style={{ fontWeight: 500, color: 'var(--ws-ink)' }}>{ind.name}:</span>
                        {' '}
                        <span style={{ color: 'var(--ws-ink-soft)' }}>{ratingLabel(ind.score)} risk</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div style={{
                borderRadius: 'var(--ws-radius)',
                border: '1px solid var(--ws-rule)',
                padding: 12,
                background: 'rgba(45,106,79,.04)',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <CheckCircle2 size={18} style={{ color: 'var(--ws-success)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)' }}>No significant concerns identified</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)' }}>
                    Across {report.coverage?.available ?? all.length} indicators assessed, this property has a clean risk profile.
                  </p>
                </div>
              </div>
            )}

            {positives.length > 0 && (
              <div style={{
                borderRadius: 'var(--ws-radius)',
                border: '1px solid var(--ws-rule)',
                padding: 12,
                background: 'rgba(45,106,79,.04)',
              }}>
                <p style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)' }}>
                  {positives.length} {positives.length === 1 ? 'thing' : 'things'} that look good
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                  {positives.map((ind) => (
                    <li key={ind.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                      <CheckCircle2 size={14} style={{ color: 'var(--ws-success)', marginTop: 2, flexShrink: 0 }} />
                      <span>
                        <span style={{ fontWeight: 500, color: 'var(--ws-ink)' }}>{ind.name}:</span>
                        {' '}
                        <span style={{ color: 'var(--ws-ink-soft)' }}>Low risk</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.coverage && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '4px 12px', borderRadius: 999,
                  background: 'rgba(13,115,119,.10)', color: 'var(--ws-piq)',
                  fontSize: 12, fontWeight: 600,
                }}>
                  {Math.round(report.coverage.percentage)}% confidence
                  <span style={{ color: 'var(--ws-piq)', opacity: 0.7, fontWeight: 500 }}>
                    ({formatCoverage(report.coverage.available, report.coverage.total)} indicators)
                  </span>
                </span>
              </div>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ws-ink-soft)', textAlign: 'center' }}>
            Indicator analysis will appear here once scoring data is available.
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={onSearchAnother}
            className="ws-btn ws-btn-primary"
            style={{ flex: 1, minWidth: 160, justifyContent: 'center', minHeight: 40 }}
          >
            <Search size={14} />
            Search another address
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="ws-btn ws-btn-outline"
            style={{ flex: 1, minWidth: 160, justifyContent: 'center', minHeight: 40 }}
          >
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>
    </Card>
  );
}
