'use client';

import { AlertTriangle, CircleCheck, CircleMinus } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { isInFloodZone } from '@/lib/hazards';
import { Card, CardHead } from '@/components/new/ui/primitives';

type Status = 'good' | 'moderate' | 'concern';

interface Item { label: string; status: Status }

export function HostedAtAGlanceNew({ report }: { report: PropertyReport }) {
  const scores = report.scores;
  if (!scores?.categories) return null;

  const getStatus = (score: number | null): Status | null => {
    if (score == null) return null;
    if (score <= 40) return 'good';
    if (score <= 65) return 'moderate';
    return 'concern';
  };

  const riskCat = scores.categories.find((c) => c.name === 'risk');
  const liveCat = scores.categories.find((c) => c.name === 'liveability');
  const transCat = scores.categories.find((c) => c.name === 'transport');

  const findInd = (cat: typeof riskCat, ...names: string[]) => {
    if (!cat) return null;
    for (const name of names) {
      const ind = cat.indicators.find((i) => i.name.toLowerCase().includes(name) && i.is_available);
      if (ind) return ind.score;
    }
    return null;
  };

  const hazards = report.hazards;
  const insuranceFactors = [
    isInFloodZone(hazards),
    hazards?.tsunami_zone,
    hazards?.liquefaction_zone,
    hazards?.coastal_erosion,
  ].filter(Boolean).length;
  const insuranceStatus: Status = insuranceFactors === 0 ? 'good' : insuranceFactors <= 2 ? 'moderate' : 'concern';

  const env = (report as unknown as { environment?: Record<string, unknown> }).environment ?? {};
  const roadNoiseDb = env.noise_db as number | null | undefined;
  const hazardsAny = hazards as unknown as Record<string, unknown> | undefined;
  const aircraftDb = hazardsAny?.aircraft_noise_dba as number | null | undefined;
  const maxNoise = Math.max(roadNoiseDb ?? 0, aircraftDb ?? 0);
  let noiseStatus: Status | null = null;
  if (maxNoise > 0) noiseStatus = maxNoise >= 70 ? 'concern' : maxNoise >= 60 ? 'moderate' : 'good';

  const live = (report as unknown as { liveability?: Record<string, unknown> }).liveability ?? {};
  const schoolsList = (live.schools_1500m as unknown[] | undefined) ?? [];
  const schoolCount = Array.isArray(schoolsList) ? schoolsList.length : ((live.school_count as number | undefined) ?? 0);
  const schoolsStatus: Status = schoolCount >= 4 ? 'good' : schoolCount >= 1 ? 'moderate' : 'concern';

  const items: (Item | null)[] = [
    { label: 'Hazard Risk', status: getStatus(riskCat?.score ?? null) ?? 'moderate' },
    { label: 'Insurance', status: insuranceStatus },
    (() => { const s = getStatus(findInd(riskCat, 'crime')); return s ? { label: 'Crime', status: s } : null; })(),
    noiseStatus ? { label: 'Noise', status: noiseStatus } : null,
    { label: 'Neighbourhood', status: getStatus(liveCat?.score ?? null) ?? 'moderate' },
    { label: 'Schools', status: schoolsStatus },
    { label: 'Transport', status: getStatus(transCat?.score ?? null) ?? 'moderate' },
    { label: 'Rent', status: report.market?.market_heat === 'hot' ? 'concern' : report.market?.market_heat === 'cold' ? 'good' : 'moderate' },
  ];
  const visible = items.filter((i): i is Item => i !== null);

  const StatusIcon = ({ s }: { s: Status }) => {
    if (s === 'good') return <CircleCheck size={14} />;
    if (s === 'moderate') return <CircleMinus size={14} />;
    return <AlertTriangle size={14} />;
  };
  const statusBg: Record<Status, string> = {
    good: 'rgba(45,106,79,.10)',
    moderate: 'rgba(230,159,0,.14)',
    concern: 'rgba(196,45,45,.10)',
  };
  const statusFg: Record<Status, string> = {
    good: 'var(--ws-success)',
    moderate: 'oklch(0.50 0.13 75)',
    concern: 'var(--ws-r-vhigh)',
  };

  const riskSuffix: Record<Status, string> = { good: 'OK', moderate: 'Watch', concern: 'Risk' };
  const lifestyleSuffix: Record<Status, string> = { good: 'Great', moderate: 'Limited', concern: 'Sparse' };

  const renderGroup = (groupLabel: string, labels: string[], suffixes: Record<Status, string>) => {
    const pills = visible.filter((i) => labels.includes(i.label));
    if (pills.length === 0) return null;
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--ws-ink-mute)',
        }}>
          {groupLabel}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {pills.map((item) => (
            <div key={item.label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 'var(--ws-radius-sm)',
              background: statusBg[item.status], color: statusFg[item.status],
              fontSize: 12, fontWeight: 500,
            }}>
              <StatusIcon s={item.status} />
              {item.label}
              <span style={{ opacity: 0.7, fontSize: 11 }}>({suffixes[item.status]})</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHead title="At a glance" meta={report.coverage ? `${report.coverage.available} / ${report.coverage.total} indicators` : undefined} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 12 }}>
        {renderGroup('Risk', ['Hazard Risk', 'Insurance', 'Crime', 'Noise'], riskSuffix)}
        {renderGroup('Lifestyle', ['Schools', 'Neighbourhood', 'Transport', 'Rent'], lifestyleSuffix)}
        {scores.percentile != null && scores.percentile > 0 && (
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
            {scores.percentile}th percentile of properties analysed.
          </p>
        )}
      </div>
    </Card>
  );
}
