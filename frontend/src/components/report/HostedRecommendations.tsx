'use client';

import { AlertTriangle, CircleDot, Circle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
  persona: string;
}

interface Recommendation {
  title: string;
  severity: string;
  actions: string[];
  byb_count?: number;
}

const SEVERITY_STYLE: Record<string, { Icon: typeof AlertTriangle; color: string; bg: string; label: string }> = {
  critical: { Icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/20', label: 'Critical' },
  important: { Icon: CircleDot, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20', label: 'Important' },
  advisory: { Icon: Circle, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20', label: 'Advisory' },
};

// Recommendations that are buyer-only (renters don't need these)
const BUYER_ONLY_TITLES = new Set([
  'Request a LIM Report',
  "Get a Builder's Report",
  'Conveyancing & Legal Checklist',
  'Ground Conditions — Foundation Check',
]);

// Recommendations that are renter-only
const RENTER_ONLY_TITLES = new Set([
  'Healthy Homes Compliance',
]);

export function HostedRecommendations({ snapshot, persona }: Props) {
  const allRecs = (snapshot.recommendations ?? []) as Recommendation[];
  if (allRecs.length === 0) return null;

  // Filter by persona
  const recs = allRecs.filter(r => {
    const title = r.title;
    if (persona === 'renter' && BUYER_ONLY_TITLES.has(title)) return false;
    if (persona === 'buyer' && RENTER_ONLY_TITLES.has(title)) return false;
    return true;
  });

  if (recs.length === 0) return null;

  const criticalCount = recs.filter(r => r.severity === 'critical').length;
  const importantCount = recs.filter(r => r.severity === 'important').length;
  const advisoryCount = recs.filter(r => r.severity === 'advisory').length;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-lg font-bold">
          {persona === 'renter' ? 'Before You Move In' : 'Before You Buy'}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {persona === 'renter'
            ? 'Property-specific checks based on this report. Discuss with your landlord.'
            : 'Property-specific due diligence based on this report. Engage professionals for each item.'}
        </p>
        <div className="flex gap-2 mt-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {criticalCount} Critical
            </span>
          )}
          {importantCount > 0 && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {importantCount} Important
            </span>
          )}
          {advisoryCount > 0 && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {advisoryCount} Advisory
            </span>
          )}
        </div>
      </div>
      <div className="px-5 pb-5 space-y-3">
        {recs.map((rec, i) => (
          <RecommendationCard key={`${rec.title}-${i}`} rec={rec} />
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(rec.severity === 'critical');
  const style = SEVERITY_STYLE[rec.severity] ?? SEVERITY_STYLE.advisory;
  const Icon = style.Icon;

  return (
    <div className={`rounded-lg border border-border/50 overflow-hidden ${style.bg}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left"
      >
        <Icon className={`h-4 w-4 ${style.color} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${style.color}`}>
              {style.label}
            </span>
            <span className="text-sm font-semibold">{rec.title}</span>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && rec.actions && rec.actions.length > 0 && (
        <div className="px-4 pb-4 pt-0">
          <ul className="space-y-2">
            {rec.actions.map((action, j) => (
              <li key={j} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                <span className="text-muted-foreground/40 mt-0.5 shrink-0">•</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
