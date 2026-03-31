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
  const planCat = scores.categories.find(c => c.name === 'planning');

  const findIndicator = (cat: typeof riskCat, ...names: string[]) => {
    if (!cat) return null;
    for (const name of names) {
      const ind = cat.indicators.find(i => i.name.toLowerCase().includes(name) && i.is_available);
      if (ind) return ind.score;
    }
    return null;
  };

  const items: GlanceItem[] = [
    { label: 'Hazard Risk', status: getStatus(riskCat?.score ?? null) },
    { label: 'Insurance', status: getStatus(findIndicator(riskCat, 'flood', 'tsunami', 'liquefaction')) },
    { label: 'Crime', status: getStatus(findIndicator(riskCat, 'crime')) },
    { label: 'Noise', status: getStatus(findIndicator(riskCat, 'noise')) },
    { label: 'Neighbourhood', status: getStatus(liveCat?.score ?? null) },
    { label: 'Schools', status: getStatus(findIndicator(liveCat, 'school')) },
    { label: 'Transport', status: getStatus(transCat?.score ?? null) },
    { label: 'Rent', status: report.market?.market_heat === 'hot' ? 'concern' : report.market?.market_heat === 'cold' ? 'good' : 'moderate' },
  ];

  const statusConfig = {
    good: { icon: <CircleCheck className="h-4 w-4" />, color: 'text-piq-success', bg: 'bg-green-100 dark:bg-green-900/20' },
    moderate: { icon: <CircleMinus className="h-4 w-4" />, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/20' },
    concern: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-risk-high', bg: 'bg-red-100 dark:bg-red-900/20' },
    unknown: { icon: <Shield className="h-4 w-4" />, color: 'text-muted-foreground', bg: 'bg-muted' },
  };

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">At a Glance</h3>
      </div>
      <div className="px-5 pb-4">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const cfg = statusConfig[item.status];
            return (
              <div
                key={item.label}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.color}`}
              >
                {cfg.icon}
                {item.label}
              </div>
            );
          })}
        </div>
        {scores.percentile != null && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Covers {report.coverage?.available ?? '?'}/{report.coverage?.total ?? '?'} indicators.
            {scores.percentile > 0 && ` ${scores.percentile}th percentile.`}
          </p>
        )}
      </div>
    </div>
  );
}
