'use client';

import { AlertTriangle, CircleDot, Circle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface Recommendation {
  title: string;
  severity: string;
  actions: string[];
}

const BUYER_ONLY = new Set([
  'Request a LIM Report',
  "Get a Builder's Report",
  'Conveyancing & Legal Checklist',
  'Ground Conditions. Foundation Check',
]);
const RENTER_ONLY = new Set(['Healthy Homes Compliance']);

const SEVERITY_STYLE: Record<string, {
  Icon: typeof AlertTriangle;
  color: string; bg: string; border: string; label: string;
}> = {
  critical: { Icon: AlertTriangle, color: 'var(--ws-r-vhigh)', bg: 'rgba(196,45,45,.06)', border: 'rgba(196,45,45,.30)', label: 'Critical' },
  important: { Icon: CircleDot,    color: 'var(--ws-r-high)',  bg: 'rgba(213,94,0,.06)',  border: 'rgba(213,94,0,.30)',  label: 'Important' },
  advisory:  { Icon: Circle,       color: 'var(--ws-piq)',     bg: 'rgba(13,115,119,.05)',border: 'rgba(13,115,119,.20)', label: 'Advisory' },
};

export function HostedRecommendationsNew({ snapshot, persona }: { snapshot: ReportSnapshot; persona: string }) {
  const all = (snapshot.recommendations ?? []) as unknown as Recommendation[];
  const recs = all.filter((r) => {
    if (persona === 'renter' && BUYER_ONLY.has(r.title)) return false;
    if (persona === 'buyer' && RENTER_ONLY.has(r.title)) return false;
    return true;
  });
  if (recs.length === 0) return null;

  const counts = {
    critical: recs.filter((r) => r.severity === 'critical').length,
    important: recs.filter((r) => r.severity === 'important').length,
    advisory: recs.filter((r) => r.severity === 'advisory').length,
  };

  return (
    <Card>
      <CardHead title="Priority actions" meta={`${recs.length} items`} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ws-ink-soft)' }}>
          {persona === 'renter'
            ? 'Property-specific checks based on this report. Discuss with your landlord.'
            : 'Property-specific due diligence based on this report. Engage professionals for each item.'}
        </p>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {counts.critical > 0 && <CountChip n={counts.critical} label="Critical" tone="critical" />}
          {counts.important > 0 && <CountChip n={counts.important} label="Important" tone="important" />}
          {counts.advisory > 0 && <CountChip n={counts.advisory} label="Advisory" tone="advisory" />}
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {recs.map((rec, i) => (
            <RecCard key={`${rec.title}-${i}`} rec={rec} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function CountChip({ n, label, tone }: { n: number; label: string; tone: keyof typeof SEVERITY_STYLE }) {
  const s = SEVERITY_STYLE[tone];
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 4,
      background: s.bg, color: s.color,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {n} {label}
    </span>
  );
}

function RecCard({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(rec.severity === 'critical');
  const style = SEVERITY_STYLE[rec.severity] ?? SEVERITY_STYLE.advisory;
  const Icon = style.Icon;
  return (
    <div style={{
      borderRadius: 'var(--ws-radius-sm)',
      border: `1px solid ${style.border}`,
      background: style.bg,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '12px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          textAlign: 'left', cursor: 'pointer',
          background: 'transparent', border: 0,
          minHeight: 44,
        }}
      >
        <Icon size={16} style={{ color: style.color, marginTop: 1, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              padding: '1px 6px', borderRadius: 3,
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: style.color, background: 'var(--ws-surface)',
            }}>
              {style.label}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)' }}>{rec.title}</span>
          </div>
        </div>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--ws-ink-mute)', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 200ms',
          }}
        />
      </button>
      {open && rec.actions && rec.actions.length > 0 && (
        <div style={{ padding: '0 14px 14px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {rec.actions.map((action, j) => (
              <li key={j} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>
                <span style={{ color: 'var(--ws-ink-mute)', flexShrink: 0, marginTop: 2 }}>•</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
