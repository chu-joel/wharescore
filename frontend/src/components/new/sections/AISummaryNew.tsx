'use client';

import { useState } from 'react';
import { Sparkles, MapPin, ChevronDown } from 'lucide-react';
import { Card, CardHead } from '@/components/new/ui/primitives';

const PREVIEW_LENGTH = 220;

function truncate(text: string, target = PREVIEW_LENGTH): string {
  if (text.length <= target) return text;
  const start = Math.max(0, target - 60);
  const end = Math.min(text.length, target + 60);
  const win = text.slice(start, end);
  const m = win.match(/[.!?](\s|$)/);
  if (m && m.index != null) return text.slice(0, start + m.index + 1);
  return text.slice(0, target).replace(/\s+\S*$/, '') + '…';
}

/**
 * AI summary + area profile — replaces classic AISummaryCard with the new
 * editorial register: lead pull-quote in `--ws-piq` rule, expandable bodies,
 * source attribution line. No Tailwind, only design tokens.
 */
export function AISummaryNew({
  summary,
  areaProfile,
  suburbName,
  loading,
}: {
  summary: string | null;
  areaProfile: string | null;
  suburbName?: string | null;
  loading?: boolean;
}) {
  const [sumOpen, setSumOpen] = useState(false);
  const [profOpen, setProfOpen] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHead title="What we read in the data" meta="Loading…" />
        <div className="ws-card-body" style={{ display: 'grid', gap: 8 }}>
          <div style={{ height: 12, background: 'var(--ws-bg-2)', borderRadius: 4 }} />
          <div style={{ height: 12, background: 'var(--ws-bg-2)', borderRadius: 4 }} />
          <div style={{ height: 12, background: 'var(--ws-bg-2)', borderRadius: 4, width: '70%' }} />
        </div>
      </Card>
    );
  }

  if (!summary && !areaProfile) {
    return (
      <Card>
        <CardHead title="What we read in the data" meta="AI summary" />
        <div className="ws-card-body" style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'center',
          fontSize: 13.5, color: 'var(--ws-ink-soft)',
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--ws-piq-light)', color: 'var(--ws-piq-dark)',
            display: 'grid', placeItems: 'center',
          }} aria-hidden="true"><Sparkles size={14} /></span>
          <span>The Claude narrative is generated when the full report is unlocked. Open a Quick or Full report for the written interpretation.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHead
        title="What we read in the data"
        meta={summary && areaProfile ? '2 sections' : 'AI summary'}
      />
      <div className="ws-card-body" style={{ display: 'grid', gap: 14 }}>
        {areaProfile && (
          <ExpandableBlock
            icon={<MapPin size={14} />}
            label={suburbName ? `About ${suburbName}` : 'About this area'}
            text={areaProfile}
            open={profOpen}
            onToggle={() => setProfOpen((v) => !v)}
          />
        )}
        {summary && (
          <ExpandableBlock
            icon={<Sparkles size={14} />}
            label="About this property"
            text={summary}
            open={sumOpen}
            onToggle={() => setSumOpen((v) => !v)}
            lead
          />
        )}
      </div>
    </Card>
  );
}

function ExpandableBlock({
  icon, label, text, open, onToggle, lead,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  open: boolean;
  onToggle: () => void;
  lead?: boolean;
}) {
  const tooLong = text.length > PREVIEW_LENGTH;
  const display = open || !tooLong ? text : truncate(text);

  return (
    <div style={{
      borderLeft: lead ? '3px solid var(--ws-piq)' : '1px solid var(--ws-rule)',
      paddingLeft: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--ws-piq-dark)', marginBottom: 6,
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 6,
          background: 'var(--ws-piq-light)', color: 'var(--ws-piq-dark)',
          display: 'grid', placeItems: 'center',
        }} aria-hidden="true">{icon}</span>
        {label}
      </div>
      <p style={{
        margin: 0,
        fontSize: lead ? 15.5 : 14,
        lineHeight: 1.55,
        color: 'var(--ws-ink)',
        maxWidth: '64ch',
        whiteSpace: 'pre-wrap',
      }}>
        {display}
      </p>
      {tooLong && (
        <button
          type="button"
          onClick={onToggle}
          className="ws-btn ws-btn-ghost"
          style={{
            marginTop: 6, padding: '0 8px', minHeight: 32,
            fontSize: 12, color: 'var(--ws-piq-dark)',
          }}
        >
          {open ? 'Show less' : 'Read more'}
          <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
        </button>
      )}
    </div>
  );
}
