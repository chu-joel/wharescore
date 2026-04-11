'use client';

import { Construction } from 'lucide-react';

interface Project {
  name: string;
  sector: string;
  status: string;
  distance_km: number;
  cost_estimate?: string;
}

interface Props {
  rawReport: Record<string, unknown>;
}

const SECTOR_COLORS: Record<string, string> = {
  Transport: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Water: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  Healthcare: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Education: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Housing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export function HostedInfrastructure({ rawReport }: Props) {
  const planning = (rawReport.planning ?? {}) as unknown as Record<string, unknown>;
  const projects = (planning.infrastructure_5km ?? planning.infrastructure_projects ?? []) as Project[];

  if (!Array.isArray(projects) || projects.length === 0) return null;

  // Sort by distance, take top 8
  const sorted = [...projects].sort((a, b) => (a.distance_km ?? 99) - (b.distance_km ?? 99)).slice(0, 8);

  const showing = sorted.length;
  const total = projects.length;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Construction className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">Infrastructure Projects</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {showing < total ? `Showing ${showing} of ${total} within 5 km` : `${total} within 5 km`}
        </span>
      </div>
      <div className="px-5 pb-5 space-y-2">
        {sorted.map((p, i) => (
          <div key={`${p.name}-${i}`} className="flex items-start gap-3 rounded-lg border border-border/50 p-2.5">
            <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-semibold ${SECTOR_COLORS[p.sector] ?? 'bg-gray-100 text-gray-600'}`}>
              {p.sector}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.distance_km != null && `${p.distance_km.toFixed(1)} km away`}
                {p.status && ` · ${p.status}`}
              </p>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-1">
          Source: NZ Infrastructure Commission, council long-term plans.
        </p>
      </div>
    </div>
  );
}
