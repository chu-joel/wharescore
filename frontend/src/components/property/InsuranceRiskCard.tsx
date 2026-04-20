'use client';

import { Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import {
  isInFloodZone,
  isNearFloodZone,
  floodProximityM,
  isInTsunamiZone,
  hasHighCoastalErosionRisk,
  hasHighWildfireRisk,
  isInLandslideRisk,
} from '@/lib/hazards';

interface InsuranceRiskCardProps {
  report: PropertyReport;
}

type RiskLevel = 'green' | 'amber' | 'red';

interface RiskFactor {
  label: string;
  present: boolean;
}

function assessInsuranceRisk(report: PropertyReport): {
  level: RiskLevel;
  factors: RiskFactor[];
  message: string;
} {
  const h = report.hazards;
  const p = report.planning;

  const slopeStr = String(h.slope_failure ?? h.council_slope_severity ?? '').toLowerCase();
  const nearFloodDist = floodProximityM(h);
  const factors: RiskFactor[] = [
    {
      label: isInFloodZone(h)
        ? 'Flood zone'
        : isNearFloodZone(h)
          ? `Close to flood zone (${nearFloodDist}m)`
          : 'Flood zone',
      present: isInFloodZone(h) || isNearFloodZone(h),
    },
    { label: 'Earthquake-prone building', present: !!p.epb_listed || !!h.epb_rating },
    { label: 'High slope failure risk', present: slopeStr.includes('high') || slopeStr.includes('very') },
    { label: 'Tsunami zone', present: isInTsunamiZone(h) },
    { label: 'Coastal erosion risk', present: hasHighCoastalErosionRisk(h) },
    { label: 'Wildfire risk', present: hasHighWildfireRisk(h) },
    { label: 'Landslide risk', present: isInLandslideRisk(h) },
  ];

  const activeFactors = factors.filter((f) => f.present);
  const criticalCount = activeFactors.length;

  let level: RiskLevel;
  let message: string;

  if (criticalCount === 0) {
    level = 'green';
    message =
      'No flood zone, earthquake-prone building, tsunami zone, coastal erosion, wildfire or mapped landslide flags — the factors insurers usually load premiums for. Standard home insurance likely at normal rates. Other risks on this report (wind, air quality, crime) don\'t typically change premiums.';
  } else if (criticalCount <= 2) {
    level = 'amber';
    const names = activeFactors.map((f) => f.label.toLowerCase()).join(', ');
    message = `May face excess or exclusions for ${names}. Get quotes from multiple insurers.`;
  } else {
    level = 'red';
    message = 'Likely to face significant premium loading or difficulty obtaining cover. Get specialist advice.';
  }

  return { level, factors, message };
}

const LEVEL_CONFIG: Record<RiskLevel, {
  Icon: typeof Shield;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  green: {
    Icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200 dark:border-green-800',
    label: 'Low Risk',
  },
  amber: {
    Icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Moderate Risk',
  },
  red: {
    Icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    label: 'High Risk',
  },
};

export function InsuranceRiskCard({ report }: InsuranceRiskCardProps) {
  const { level, factors, message } = assessInsuranceRisk(report);
  const config = LEVEL_CONFIG[level];
  const Icon = config.Icon;
  const activeFactors = factors.filter((f) => f.present);

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 space-y-3`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/60 dark:bg-black/20 shrink-0">
          <Icon className={`h-5 w-5 ${config.color}`} />
        </div>
        <div>
          <p className={`text-sm font-bold ${config.color}`}>
            Insurance Risk: {config.label}
          </p>
          <p className="text-xs text-muted-foreground">
            Checks {factors.length} insurer-relevant hazards
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>

      {activeFactors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFactors.map((f) => (
            <span
              key={f.label}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 text-xs font-medium"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              {f.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
