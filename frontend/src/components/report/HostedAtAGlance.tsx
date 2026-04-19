'use client';

import { AlertTriangle, CircleCheck, CircleMinus } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { isInFloodZone } from '@/lib/hazards';

interface Props {
  report: PropertyReport;
}

type GlanceStatus = 'good' | 'moderate' | 'concern';

interface GlanceItem {
  label: string;
  status: GlanceStatus;
}

export function HostedAtAGlance({ report }: Props) {
  const scores = report.scores;
  if (!scores?.categories) return null;

  const getStatus = (score: number | null): GlanceStatus | null => {
    if (score == null) return null;
    if (score <= 40) return 'good';
    if (score <= 65) return 'moderate';
    return 'concern';
  };

  const riskCat = scores.categories.find(c => c.name === 'risk');
  const liveCat = scores.categories.find(c => c.name === 'liveability');
  const transCat = scores.categories.find(c => c.name === 'transport');

  const findIndicator = (cat: typeof riskCat, ...names: string[]) => {
    if (!cat) return null;
    for (const name of names) {
      const ind = cat.indicators.find(i => i.name.toLowerCase().includes(name) && i.is_available);
      if (ind) return ind.score;
    }
    return null;
  };

  // Insurance — derive from actual hazard data fields (not indicator search, which can miss)
  const hazards = report.hazards;
  const insuranceFactors = [isInFloodZone(hazards), hazards?.tsunami_zone, hazards?.liquefaction_zone, hazards?.coastal_erosion].filter(Boolean).length;
  const insuranceStatus: GlanceStatus = insuranceFactors === 0 ? 'good' : insuranceFactors <= 2 ? 'moderate' : 'concern';

  // Noise — derive from real environment / aircraft data, not from a risk indicator score which
  // was frequently null (giving a confusing "Noise (?)" pill). If we don't have any measurement,
  // we omit the Noise pill entirely rather than rendering a phantom "(?)".
  const env = (report as unknown as { environment?: Record<string, unknown> }).environment ?? {};
  const roadNoiseDb = env.road_noise_db as number | null | undefined;
  const hazardsAny = hazards as unknown as Record<string, unknown> | undefined;
  const aircraftNoiseDb = hazardsAny?.aircraft_noise_dba as number | null | undefined;
  const maxNoise = Math.max(roadNoiseDb ?? 0, aircraftNoiseDb ?? 0);
  let noiseStatus: GlanceStatus | null = null;
  if (maxNoise > 0) {
    noiseStatus = maxNoise >= 70 ? 'concern' : maxNoise >= 60 ? 'moderate' : 'good';
  }

  // Schools — derive from the real school count around the property, not from a risk indicator.
  // Previously this was pulling a liveability sub-score that often flagged urban areas with
  // plenty of schools as "Risk", contradicting the findings copy right below it.
  const live = (report as unknown as { liveability?: Record<string, unknown> }).liveability ?? {};
  const schoolsList = (live.schools_1500m as unknown[] | undefined) ?? [];
  const schoolCount = Array.isArray(schoolsList) ? schoolsList.length : ((live.school_count as number | undefined) ?? 0);
  const schoolsStatus: GlanceStatus = schoolCount >= 4 ? 'good' : schoolCount >= 1 ? 'moderate' : 'concern';

  const items: (GlanceItem | null)[] = [
    { label: 'Hazard Risk', status: getStatus(riskCat?.score ?? null) ?? 'moderate' },
    { label: 'Insurance', status: insuranceStatus },
    (() => { const s = getStatus(findIndicator(riskCat, 'crime')); return s ? { label: 'Crime', status: s } : null; })(),
    noiseStatus ? { label: 'Noise', status: noiseStatus } : null,
    { label: 'Neighbourhood', status: getStatus(liveCat?.score ?? null) ?? 'moderate' },
    { label: 'Schools', status: schoolsStatus },
    { label: 'Transport', status: getStatus(transCat?.score ?? null) ?? 'moderate' },
    { label: 'Rent', status: report.market?.market_heat === 'hot' ? 'concern' : report.market?.market_heat === 'cold' ? 'good' : 'moderate' },
  ];
  const visibleItems = items.filter((i): i is GlanceItem => i !== null);

  const statusConfig: Record<GlanceStatus, { icon: React.ReactNode; color: string; bg: string; suffix: string }> = {
    good: { icon: <CircleCheck className="h-4 w-4" />, color: 'text-piq-success', bg: 'bg-green-100 dark:bg-green-900/20', suffix: 'OK' },
    moderate: { icon: <CircleMinus className="h-4 w-4" />, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/20', suffix: 'Watch' },
    concern: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-risk-high', bg: 'bg-red-100 dark:bg-red-900/20', suffix: 'Risk' },
  };

  const renderGroup = (groupLabel: string, labels: string[]) => {
    const pills = visibleItems.filter(i => labels.includes(i.label));
    if (pills.length === 0) return null;
    return (
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{groupLabel}</p>
        <div className="flex flex-wrap gap-2">
          {pills.map((item) => {
            const cfg = statusConfig[item.status];
            return (
              <div
                key={item.label}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.color}`}
              >
                {cfg.icon}
                {item.label}
                <span className="opacity-70 text-xs">({cfg.suffix})</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">At a Glance</h3>
      </div>
      <div className="px-5 pb-4 space-y-2">
        {renderGroup('Risk', ['Hazard Risk', 'Insurance', 'Crime', 'Noise'])}
        {renderGroup('Lifestyle', ['Schools', 'Neighbourhood', 'Transport', 'Rent'])}
        {scores.percentile != null && (
          <p className="text-xs text-muted-foreground mt-2">
            Covers {report.coverage?.available ?? '?'}/{report.coverage?.total ?? '?'} indicators.
            {scores.percentile > 0 && ` ${scores.percentile}th percentile.`}
          </p>
        )}
      </div>
    </div>
  );
}
