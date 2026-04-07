'use client';

import { Shield, AlertTriangle, CircleCheck, CircleMinus } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface Props {
  report: PropertyReport;
}

interface GlanceItem {
  label: string;
  status: 'good' | 'moderate' | 'concern' | 'unknown';
}

export function HostedAtAGlance({ report }: Props) {
  const scores = report.scores;
  if (!scores?.categories) return null;

  const getStatus = (score: number | null): 'good' | 'moderate' | 'concern' | 'unknown' => {
    if (score == null) return 'unknown';
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
  const insuranceFactors = [hazards?.flood_zone, hazards?.tsunami_zone, hazards?.liquefaction_zone, hazards?.coastal_erosion].filter(Boolean).length;
  const insuranceStatus: GlanceItem['status'] = insuranceFactors === 0 ? 'good' : insuranceFactors <= 2 ? 'moderate' : 'concern';

  const items: GlanceItem[] = [
    { label: 'Hazard Risk', status: getStatus(riskCat?.score ?? null) },
    { label: 'Insurance', status: insuranceStatus },
    { label: 'Crime', status: getStatus(findIndicator(riskCat, 'crime')) },
    { label: 'Noise', status: getStatus(findIndicator(riskCat, 'noise')) },
    { label: 'Neighbourhood', status: getStatus(liveCat?.score ?? null) },
    { label: 'Schools', status: getStatus(findIndicator(liveCat, 'school')) },
    { label: 'Transport', status: getStatus(transCat?.score ?? null) },
    { label: 'Rent', status: report.market?.market_heat === 'hot' ? 'concern' : report.market?.market_heat === 'cold' ? 'good' : 'moderate' },
  ];

  const statusConfig = {
    good: { icon: <CircleCheck className="h-4 w-4" />, color: 'text-piq-success', bg: 'bg-green-100 dark:bg-green-900/20', suffix: 'OK' },
    moderate: { icon: <CircleMinus className="h-4 w-4" />, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/20', suffix: 'Watch' },
    concern: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-risk-high', bg: 'bg-red-100 dark:bg-red-900/20', suffix: 'Risk' },
    unknown: { icon: <Shield className="h-4 w-4" />, color: 'text-muted-foreground', bg: 'bg-muted', suffix: '?' },
  };

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">At a Glance</h3>
      </div>
      <div className="px-5 pb-4 space-y-2">
        {/* Risk group */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Risk</p>
          <div className="flex flex-wrap gap-2">
            {items.filter(i => ['Hazard Risk', 'Insurance', 'Crime', 'Noise'].includes(i.label)).map((item) => {
              const cfg = statusConfig[item.status];
              return (
                <div
                  key={item.label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.color}`}
                >
                  {cfg.icon}
                  {item.label}
                  <span className="opacity-70 text-[10px]">({cfg.suffix})</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Lifestyle group */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Lifestyle</p>
          <div className="flex flex-wrap gap-2">
            {items.filter(i => ['Schools', 'Neighbourhood', 'Transport', 'Rent'].includes(i.label)).map((item) => {
              const cfg = statusConfig[item.status];
              return (
                <div
                  key={item.label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.color}`}
                >
                  {cfg.icon}
                  {item.label}
                  <span className="opacity-70 text-[10px]">({cfg.suffix})</span>
                </div>
              );
            })}
          </div>
        </div>
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
