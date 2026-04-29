'use client';

import type { PropertyReport } from '@/lib/types';
import type { Persona } from '@/stores/personaStore';
import { CompareRow } from './CompareRow';
import {
  type ColumnLabel,
  type CompareValue,
  presentNumber,
  negativeKnown,
  unknown,
} from '@/lib/compareDiff';

interface CompareScoreboardProps {
  reports: PropertyReport[];
  columns: ColumnLabel[];
  persona: Persona;
}

const fmtCurrency0 = (n: number) =>
  `$${Math.round(n).toLocaleString('en-NZ')}`;

function riskScoreValue(r: PropertyReport): CompareValue {
  const score = r.scores?.overall;
  if (typeof score !== 'number' || !Number.isFinite(score)) return unknown();
  return presentNumber(score, String(Math.round(score)));
}

function criticalFindingsValue(r: PropertyReport, persona: Persona): CompareValue {
  // Use ranked_findings when present (canonical source). Per-persona list is
  // preferred — the buyer and renter weightings rank different hazards as
  // critical. Fall back through the persona-specific list, then the other
  // persona, then generic; pick the first non-empty one.
  const ranked = r.ranked_findings;
  let list: Array<{ severity: string }> | null = null;
  if (ranked) {
    const candidates = [
      ranked[persona],
      persona === 'renter' ? ranked.buyer : ranked.renter,
      ranked.generic,
    ];
    list = candidates.find((c) => c && c.length > 0) ?? null;
  }
  if (list) {
    const count = list.filter((f) => f.severity === 'critical').length;
    if (count === 0) return negativeKnown('None');
    return presentNumber(count, String(count));
  }
  // Final fallback — count clearly-critical hazard signals on the report.
  let n = 0;
  if (r.hazards.flood_zone) n += 1;
  if (r.hazards.tsunami_zone) n += 1;
  if (r.hazards.liquefaction_zone) n += 1;
  if (r.hazards.slope_failure?.toLowerCase().includes('high')) n += 1;
  if (n === 0) return negativeKnown('None');
  return presentNumber(n, String(n));
}

function primaryDollarValue(r: PropertyReport, persona: Persona): CompareValue {
  if (persona === 'renter') {
    const m = r.market.rent_assessment?.median;
    if (m == null) return unknown();
    return presentNumber(m, `${fmtCurrency0(m)}/wk`);
  }
  // buyer — use CV as proxy for "the price you'd pay"; price advisor isn't on
  // the live report path. Phase B can swap to price_estimate.
  const cv = r.property.capital_value;
  if (cv == null) return unknown();
  return presentNumber(cv, fmtCurrency0(cv));
}

export function CompareScoreboard({
  reports,
  columns,
  persona,
}: CompareScoreboardProps) {
  const primaryLabel = persona === 'renter' ? 'Median rent' : 'Capital value';

  return (
    <section
      aria-label="Headline comparison"
      className="rounded-xl border border-border bg-card shadow-sm p-3 sm:p-4 space-y-3 sm:space-y-2"
    >
      <CompareRow
        label="Risk score"
        values={reports.map(riskScoreValue)}
        columns={columns}
        strategy="lower-better"
        formatDelta={(w, l) => {
          if (w.kind !== 'present' || l.kind !== 'present') return '';
          const d = (l.value as number) - (w.value as number);
          return `${Math.round(d)} points lower`;
        }}
      />
      <CompareRow
        label="Critical findings"
        values={reports.map((r) => criticalFindingsValue(r, persona))}
        columns={columns}
        strategy="lower-better"
        formatDelta={(w, l) => {
          if (w.kind !== 'present' || l.kind !== 'present') return '';
          const d = (l.value as number) - (w.value as number);
          return `${Math.round(d)} fewer critical issue${Math.abs(d) === 1 ? '' : 's'}`;
        }}
      />
      <CompareRow
        label={primaryLabel}
        values={reports.map((r) => primaryDollarValue(r, persona))}
        columns={columns}
        strategy="lower-better"
        formatDelta={(w, l) => {
          if (w.kind !== 'present' || l.kind !== 'present') return '';
          const d = (l.value as number) - (w.value as number);
          if (persona === 'renter') return `$${Math.round(d)}/wk cheaper`;
          if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(2)}M lower CV`;
          if (d >= 1000) return `$${Math.round(d / 1000)}k lower CV`;
          return `$${Math.round(d)} lower CV`;
        }}
      />
    </section>
  );
}
