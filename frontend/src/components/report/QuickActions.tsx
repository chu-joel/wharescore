'use client';

import { AlertTriangle, CircleDot, Circle, ArrowRight } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
  persona: string;
}

interface Recommendation {
  title: string;
  severity: string;
  actions: string[];
}

const SEVERITY_ICON = {
  critical: AlertTriangle,
  important: CircleDot,
  advisory: Circle,
} as const;

const SEVERITY_COLOR = {
  critical: 'text-red-600 dark:text-red-400',
  important: 'text-amber-600 dark:text-amber-400',
  advisory: 'text-blue-600 dark:text-blue-400',
} as const;

// Persona-specific filters (same as HostedRecommendations)
const BUYER_ONLY = new Set(['Request a LIM Report', "Get a Builder's Report", 'Conveyancing & Legal Checklist', 'Ground Conditions — Foundation Check']);
const RENTER_ONLY = new Set(['Healthy Homes Compliance']);

export function QuickActions({ snapshot, persona }: Props) {
  const allRecs = (snapshot.recommendations ?? []) as unknown as Recommendation[];
  if (allRecs.length === 0) return null;

  const filtered = allRecs.filter(r => {
    if (persona === 'renter' && BUYER_ONLY.has(r.title)) return false;
    if (persona === 'buyer' && RENTER_ONLY.has(r.title)) return false;
    return true;
  });

  // Take top 3 by severity priority
  const severityOrder = { critical: 0, important: 1, advisory: 2 };
  const top3 = [...filtered]
    .sort((a, b) => (severityOrder[a.severity as keyof typeof severityOrder] ?? 3) - (severityOrder[b.severity as keyof typeof severityOrder] ?? 3))
    .slice(0, 3);

  if (top3.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <ArrowRight className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">
          {persona === 'renter' ? 'Before You Move In' : 'Before You Buy'}
        </h3>
      </div>
      <div className="px-5 pb-5 space-y-2">
        {top3.map((rec, i) => {
          const Icon = SEVERITY_ICON[rec.severity as keyof typeof SEVERITY_ICON] || Circle;
          const color = SEVERITY_COLOR[rec.severity as keyof typeof SEVERITY_COLOR] || 'text-muted-foreground';
          return (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{rec.title}</p>
                {rec.actions?.[0] && (
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.actions[0]}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
