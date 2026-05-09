'use client';

import { AlertTriangle, Triangle, CheckCircle2, Info, Lock } from 'lucide-react';
import { generateFindings, type Finding } from '@/components/property/FindingCard';
import type { PropertyReport } from '@/lib/types';
import type { Persona } from '@/stores/personaStore';
import { useRentInputStore } from '@/stores/rentInputStore';
import { useBuyerInputStore } from '@/stores/buyerInputStore';
import { useTypologyMedian } from '@/hooks/useTypologyMedian';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { Card, CardHead, SeverityTag, type Severity } from '@/components/new/ui/primitives';

/**
 * KeyFindingsNew — drop-in replacement for `KeyFindings` from
 * `components/property/KeyFindings`. Same logic (`generateFindings`,
 * persona-aware backend ranking, free / gated slice), redrawn in the new
 * design system: severity glyph + keyword + colour, no card grid, source
 * attribution per finding.
 */
export function KeyFindingsNew({
  report,
  maxFree = 5,
  persona,
  addressId,
}: {
  report: PropertyReport;
  maxFree?: number;
  persona?: Persona;
  addressId?: number;
}) {
  const weeklyRent = useRentInputStore((s) => s.weeklyRent);
  const askingPrice = useBuyerInputStore((s) => s.askingPrice);
  const typologyMedian = useTypologyMedian(report.market?.rental_overview ?? []).median;
  const setShowUpgrade = useDownloadGateStore((s) => s.setShowUpgradeModal);

  const allFindings = generateFindings(report, persona, { weeklyRent, askingPrice, typologyMedian });

  if (allFindings.length === 0) {
    return (
      <Card>
        <CardHead title="Key findings" meta="Nothing notable" />
        <div className="ws-card-body">
          <p style={{ margin: 0, color: 'var(--ws-ink-soft)' }}>
            We didn&rsquo;t find any notable concerns or highlights for this address.
          </p>
        </div>
      </Card>
    );
  }

  // Mirror existing free / hidden split.
  const personaKey: 'renter' | 'buyer' = persona === 'renter' ? 'renter' : 'buyer';
  const backendRanked = report.ranked_findings?.[personaKey];
  let freeFindings: Finding[];
  if (backendRanked && backendRanked.length > 0) {
    const converted = backendRanked.map(asFrontendFinding).slice(0, maxFree);
    if (converted.length < maxFree) {
      const chosen = new Set(converted.map((f) => f.headline));
      const filler = allFindings.filter((f) => !chosen.has(f.headline));
      converted.push(...filler.slice(0, maxFree - converted.length));
    }
    freeFindings = converted;
  } else {
    freeFindings = allFindings.slice(0, maxFree);
  }
  const freeHeadlines = new Set(freeFindings.map((f) => f.headline));
  const hiddenFindings = allFindings.filter((f) => !freeHeadlines.has(f.headline));

  const counts = {
    crit: allFindings.filter((f) => f.severity === 'critical').length,
    warn: allFindings.filter((f) => f.severity === 'warning').length,
    info: allFindings.filter((f) => f.severity === 'info').length,
    good: allFindings.filter((f) => f.severity === 'positive').length,
  };

  return (
    <Card>
      <CardHead
        title={`Key findings`}
        meta={`${allFindings.length} total · ${freeFindings.length} shown`}
      />
      <div className="ws-card-body">
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--ws-ink-soft)' }}>
          {counts.crit > 0 && <span style={{ color: 'var(--ws-r-vhigh)', fontWeight: 600 }}>{counts.crit} critical · </span>}
          {counts.warn > 0 && <span style={{ color: 'var(--ws-r-high)', fontWeight: 600 }}>{counts.warn} to watch · </span>}
          {counts.info > 0 && <span style={{ color: 'var(--ws-piq)', fontWeight: 600 }}>{counts.info} note{counts.info === 1 ? '' : 's'} · </span>}
          {counts.good > 0 && <span style={{ color: 'var(--ws-success)', fontWeight: 600 }}>{counts.good} good</span>}
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          {freeFindings.map((f, i) => (
            <FindingRow key={`${f.headline}-${i}`} finding={f} />
          ))}
        </div>

        {hiddenFindings.length > 0 && (
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              border: '1px dashed var(--ws-rule-strong)',
              borderRadius: 'var(--ws-radius)',
              background: 'var(--ws-bg-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--ws-ink)' }}>
              <Lock size={13} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--ws-ink-mute)' }} />
              <strong>Plus {hiddenFindings.length} more</strong> in the full report.
            </span>
            <button
              className="ws-btn ws-btn-primary"
              onClick={() => setShowUpgrade(true, 'default', {}, addressId ?? null)}
            >
              Unlock
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const sev = mapSeverity(finding.severity);
  const Icon = iconFor(finding.severity);
  return (
    <div className={`ws-finding ${sev}`}>
      <div className="ico" aria-hidden="true">
        <Icon size={16} />
      </div>
      <div>
        <strong>
          {finding.headline}
          <SeverityTag severity={sev} />
        </strong>
        <p>{finding.interpretation}</p>
        <div className="src">
          Source: {finding.sourceUrl ? <a href={finding.sourceUrl} target="_blank" rel="noopener noreferrer">{finding.source}</a> : finding.source}
        </div>
      </div>
    </div>
  );
}

function asFrontendFinding(
  ranked: { severity: string; title: string; detail: string; source?: { authority: string; url: string } },
): Finding {
  const sev = ranked.severity as Finding['severity'];
  const safe: Finding['severity'] =
    sev === 'critical' || sev === 'warning' || sev === 'info' || sev === 'positive' ? sev : 'info';
  return {
    severity: safe,
    headline: ranked.title,
    interpretation: ranked.detail || '',
    category: 'ranked',
    source: ranked.source?.authority || 'WhareScore data',
    sourceUrl: ranked.source?.url,
  };
}

function mapSeverity(s: Finding['severity']): Severity {
  if (s === 'critical') return 'crit';
  if (s === 'warning') return 'warn';
  if (s === 'positive') return 'good';
  return 'info';
}

function iconFor(s: Finding['severity']) {
  if (s === 'critical') return AlertTriangle;
  if (s === 'warning') return Triangle;
  if (s === 'positive') return CheckCircle2;
  return Info;
}
