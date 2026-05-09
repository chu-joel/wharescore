'use client';

import { useState } from 'react';
import { ChevronDown, Shield, CheckCircle2 } from 'lucide-react';
import type { PropertyReport, ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';
import {
  buildAdviceSections,
  type AdviceSection,
} from '@/components/report/HostedHazardAdvice';

interface Props {
  report: PropertyReport;
  snapshot: ReportSnapshot;
  persona: 'buyer' | 'renter';
}

const SEVERITY_STYLES: Record<AdviceSection['severity'], {
  border: string;
  accent: string;
  bg: string;
  fg: string;
  label: string;
}> = {
  critical: {
    border: 'rgba(196,45,45,.30)', accent: 'var(--ws-r-vhigh)',
    bg: 'rgba(196,45,45,.05)', fg: 'var(--ws-r-vhigh)', label: 'Critical',
  },
  warning: {
    border: 'rgba(213,94,0,.30)', accent: 'var(--ws-r-high)',
    bg: 'rgba(213,94,0,.05)', fg: 'var(--ws-r-high)', label: 'Watch',
  },
  info: {
    border: 'rgba(13,115,119,.20)', accent: 'var(--ws-piq)',
    bg: 'rgba(13,115,119,.04)', fg: 'var(--ws-piq)', label: 'Info',
  },
};

export function HostedHazardAdviceNew({ report, snapshot, persona }: Props) {
  const ta = snapshot.meta.ta_name;
  const hasTimeline = !!snapshot.coastal && snapshot.coastal.tier !== 'not_applicable';
  const sections = buildAdviceSections(report, ta, persona, hasTimeline);

  if (sections.length <= 1) return null;

  const criticalCount = sections.filter(s => s.severity === 'critical').length;
  const warningCount = sections.filter(s => s.severity === 'warning').length;

  return (
    <Card>
      <CardHead title="Safety & Hazard Guide" meta={<Shield size={16} style={{ color: 'var(--ws-piq)' }} />} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>
          Actionable advice specific to this property&apos;s detected hazards. Based on NZ Civil Defence, GNS Science, NEMA, and post-disaster research.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {criticalCount > 0 && <CountChip n={criticalCount} label="Critical" tone="critical" />}
          {warningCount > 0 && <CountChip n={warningCount} label="Watch" tone="warning" />}
          <CountChip n={sections.length} label="Topics" tone="info" />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {sections.map((section) => (
            <HazardAdviceCard key={section.id} section={section} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function CountChip({ n, label, tone }: { n: number; label: string; tone: AdviceSection['severity'] }) {
  const s = SEVERITY_STYLES[tone];
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 4,
      background: s.bg, color: s.fg,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {n} {label}
    </span>
  );
}

function HazardAdviceCard({ section }: { section: AdviceSection }) {
  const [open, setOpen] = useState(section.severity === 'critical');
  const style = SEVERITY_STYLES[section.severity];
  const Icon = section.icon;

  return (
    <div style={{
      borderRadius: 'var(--ws-radius-sm)',
      border: `1px solid ${style.border}`,
      borderLeft: `4px solid ${style.accent}`,
      background: style.bg,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '12px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer',
          minHeight: 44,
        }}
      >
        <Icon size={18} style={{ color: style.fg, flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              padding: '1px 6px', borderRadius: 3,
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: style.fg, background: 'var(--ws-surface)',
            }}>
              {style.label}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)' }}>{section.title}</span>
          </div>
          <p style={{
            margin: '4px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.55,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {section.intro}
          </p>
        </div>
        <ChevronDown size={16} style={{
          color: 'var(--ws-ink-mute)', flexShrink: 0, marginTop: 4,
          transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms',
        }} />
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', display: 'grid', gap: 14 }}>
          {section.subsections.map((sub, i) => (
            <div key={i}>
              <h5 style={{
                margin: '0 0 6px', fontSize: 11, fontWeight: 700,
                color: 'var(--ws-ink)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: style.accent }} />
                {sub.heading}
              </h5>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                {sub.items.map((item, j) => (
                  <li key={j} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.6,
                  }}>
                    <CheckCircle2 size={12} style={{ flexShrink: 0, marginTop: 4, color: 'var(--ws-ink-mute)', opacity: 0.5 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
