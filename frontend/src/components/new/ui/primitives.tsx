'use client';

import { ReactNode } from 'react';

/* ===== Card ===== */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`ws-card ${className}`.trim()}>{children}</section>;
}
export function CardHead({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="ws-card-head">
      <h2>{title}</h2>
      {meta && <span className="meta">{meta}</span>}
    </div>
  );
}
export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ws-card-body ${className}`.trim()}>{children}</div>;
}

/* ===== Severity tag (glyph + keyword + colour, WCAG 1.4.1) ===== */
export type Severity = 'crit' | 'warn' | 'info' | 'good';
const SEV_GLYPH: Record<Severity, string> = { crit: '!', warn: '△', info: 'i', good: '✓' };
const SEV_LABEL: Record<Severity, string> = { crit: 'Critical', warn: 'Warning', info: 'Info', good: 'Strong' };
export function SeverityTag({ severity, label }: { severity: Severity; label?: string }) {
  return (
    <span className={`ws-sev ${severity}`}>
      <span className="glyph" aria-hidden="true">{SEV_GLYPH[severity]}</span>
      {label ?? SEV_LABEL[severity]}
    </span>
  );
}

/* ===== Pill (used in layer-row outcomes) ===== */
export type PillTone = 'low' | 'mod' | 'high' | 'crit';
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={`ws-pill ${tone}`}>{children}</span>;
}

/* ===== Badge (general-purpose) ===== */
export function Badge({ tone, children }: { tone?: 'crit' | 'warn' | 'good' | 'info' | 'neutral'; children: ReactNode }) {
  const cls = !tone || tone === 'neutral' ? '' : tone;
  return <span className={`ws-badge ${cls}`.trim()}>{children}</span>;
}

/* ===== Stat (asymmetric stat grid) ===== */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="ws-stat-grid">{children}</div>;
}
export function Stat({ label, value, valueSmall, delta, deltaTone, primary }: {
  label: string;
  value: ReactNode;
  valueSmall?: string;
  delta?: ReactNode;
  deltaTone?: 'pos' | 'neg';
  primary?: boolean;
}) {
  return (
    <div className="ws-stat" style={primary ? { padding: '18px 20px' } : undefined}>
      <div className="lbl">{label}</div>
      <div className="val" style={primary ? { fontSize: 32 } : undefined}>
        {value}
        {valueSmall && <small> {valueSmall}</small>}
      </div>
      {delta && <div className={`delta ${deltaTone ?? ''}`.trim()}>{delta}</div>}
    </div>
  );
}

/* ===== Indicator chip ===== */
export type IndTone = 'r-vlow' | 'r-low' | 'r-mod' | 'r-high' | 'r-vhigh';
export function indToneFor(value: number, lowerIsBetter = false): IndTone {
  // 0-100 score, higher = better unless lowerIsBetter.
  const v = lowerIsBetter ? 100 - value : value;
  if (v >= 75) return 'r-vlow';
  if (v >= 55) return 'r-mod';
  if (v >= 35) return 'r-high';
  return 'r-vhigh';
}
export function IndicatorChip({ name, value, suffix = '/100', tone }: { name: string; value: number; suffix?: string; tone: IndTone }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`ws-ind ${tone}`}>
      <div className="nm" title={name}>{name}</div>
      <div className="v">{Number.isInteger(value) ? value : value.toFixed(1)}<small>{suffix}</small></div>
      <div className="bar"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/* ===== Bar row (comparison) ===== */
export function BarRow({ label, hint, value, fillPct, refPct, fillColor, lowerIsBetter }: {
  label: string;
  hint?: string;
  value: ReactNode;
  fillPct: number;
  refPct: number;
  fillColor?: string;
  lowerIsBetter?: boolean;
}) {
  // When lower is better the bar visually inverts: long fill = good (we colour green).
  return (
    <div className="ws-bar-row">
      <span className="l">{label}{hint && <small style={{ color: 'var(--ws-ink-mute)', fontSize: 11, marginLeft: 4 }}>{hint}</small>}</span>
      <div className="ws-bar">
        <div className="fill" style={{ width: `${fillPct}%`, background: fillColor ?? (lowerIsBetter ? 'var(--ws-success)' : 'var(--ws-piq)') }} />
        <div className="ref" style={{ left: `${refPct}%` }} />
      </div>
      <span className="v">{value}</span>
    </div>
  );
}

/* ===== Layer row ===== */
export function LayerRow({ icon, name, source, pillTone, pillLabel }: {
  icon: ReactNode;
  name: string;
  source: string;
  pillTone: PillTone;
  pillLabel: string;
}) {
  return (
    <div className="ws-layer-row">
      <div className="ico" aria-hidden="true">{icon}</div>
      <div>
        <div className="name">{name}</div>
        <div className="source">{source}</div>
      </div>
      <Pill tone={pillTone}>{pillLabel}</Pill>
      <span style={{ color: 'var(--ws-ink-mute)' }}>›</span>
    </div>
  );
}

/* ===== Finding ===== */
export function Finding({ severity, icon, title, body, sourceText, sourceHref }: {
  severity: Severity;
  icon: ReactNode;
  title: string;
  body: string;
  sourceText: string;
  sourceHref?: string;
}) {
  return (
    <div className={`ws-finding ${severity}`}>
      <div className="ico" aria-hidden="true">{icon}</div>
      <div>
        <strong>{title} <SeverityTag severity={severity} /></strong>
        <p>{body}</p>
        <div className="src">Source: {sourceHref ? <a href={sourceHref}>{sourceText}</a> : sourceText}</div>
      </div>
    </div>
  );
}

/* ===== Accordion (uses native <details>) ===== */
export function Accordion({ icon, head, sub, count, children, open }: {
  icon: ReactNode;
  head: string;
  sub?: string;
  count?: ReactNode;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="ws-acc" open={open}>
      <summary>
        <span className="ico" aria-hidden="true">{icon}</span>
        <div>
          <div className="head">{head}</div>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {count !== undefined && <span className="count">{count}</span>}
        <span className="chev">›</span>
      </summary>
      <div className="acc-body">{children}</div>
    </details>
  );
}

/* ===== Persona toggle ===== */
export type Persona = 'buyer' | 'renter';
export function PersonaToggle({ value, onChange }: { value: Persona; onChange: (p: Persona) => void }) {
  return (
    <div className="ws-pill-toggle" role="tablist" aria-label="Persona">
      {(['buyer', 'renter'] as Persona[]).map((p) => (
        <button
          key={p}
          role="tab"
          aria-selected={value === p}
          className={value === p ? 'active' : ''}
          onClick={() => onChange(p)}
          style={{ minHeight: 40, padding: '0 16px' }}
        >
          {p[0].toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  );
}
