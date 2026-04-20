'use client';

import { Droplets, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { isInFloodZone } from '@/lib/hazards';

interface Props {
  report: PropertyReport;
}

interface RiskFactor {
  label: string;
  detail: string;
  severity: 'high' | 'moderate' | 'low';
}

/**
 * Mould & Dampness Risk assessment for renters.
 *
 * 20.6% of NZ renters live in damp dwellings (Stats NZ).
 * 16.5% have mould larger than A4 size.
 * This card combines property-specific data to assess dampness risk
 * and gives practical viewing advice.
 */
export function MouldDampnessRisk({ report }: Props) {
  const hazards = report.hazards;
  const terrain = report.terrain;
  const environment = report.environment;

  const factors: RiskFactor[] = [];

  // South-facing = less sun = more moisture retention
  const aspect = terrain?.aspect_label;
  if (aspect === 'S' || aspect === 'SE' || aspect === 'SW') {
    factors.push({
      label: `${aspect}-facing: limited sun`,
      detail: 'Less sun means slower drying. Check for condensation on windows and mould in wardrobes.',
      severity: aspect === 'S' ? 'high' : 'moderate',
    });
  }

  // Flood zone = ground moisture
  if (isInFloodZone(hazards)) {
    factors.push({
      label: 'In a flood zone',
      detail: 'Higher ground moisture. Check subfloor ventilation and look for rising damp on walls.',
      severity: 'high',
    });
  }

  // High liquefaction = unstable water table
  const liq = String(hazards?.liquefaction_zone || '').toLowerCase();
  if (liq.includes('high') || liq.includes('very')) {
    factors.push({
      label: 'High liquefaction zone',
      detail: 'High water table area. Subfloor dampness more likely. Ask about ground moisture barriers.',
      severity: 'moderate',
    });
  }

  // Depression / low-lying = water collects
  if (terrain?.is_depression && terrain.depression_depth_m && terrain.depression_depth_m > 0.5) {
    factors.push({
      label: `Low-lying position (${terrain.depression_depth_m.toFixed(1)}m below surroundings)`,
      detail: 'Water naturally collects here. Higher risk of surface flooding and persistent dampness.',
      severity: 'high',
    });
  }

  // Coastal erosion = salt air + moisture
  if (hazards?.coastal_erosion_exposure) {
    factors.push({
      label: 'Coastal exposure',
      detail: 'Salt air accelerates weathering and can increase moisture ingress through aging cladding.',
      severity: 'moderate',
    });
  }

  // High wind + rain = driving rain penetration
  const windZone = String(environment?.wind_zone || '').toUpperCase();
  if (['EH', 'SED', 'VH', 'VERY HIGH', 'EXTRA HIGH'].includes(windZone)) {
    factors.push({
      label: `Extreme wind zone (${windZone})`,
      detail: 'Driving rain can penetrate window seals and cladding. Check for water stains around windows.',
      severity: 'moderate',
    });
  }

  // Low elevation near coast
  if (hazards?.coastal_elevation_cm != null && hazards.coastal_elevation_cm < 300) {
    factors.push({
      label: `Only ${(hazards.coastal_elevation_cm / 100).toFixed(1)}m above sea level`,
      detail: 'Very low elevation increases groundwater and flood risk.',
      severity: hazards.coastal_elevation_cm < 150 ? 'high' : 'moderate',
    });
  }

  // Overland flow path
  if (hazards?.overland_flow_within_50m) {
    factors.push({
      label: 'Overland flow path nearby',
      detail: 'Surface water may flow through or near the property during heavy rain.',
      severity: 'moderate',
    });
  }

  const highCount = factors.filter(f => f.severity === 'high').length;
  const modCount = factors.filter(f => f.severity === 'moderate').length;
  // Flood zone is a qualitatively different factor — past flooding leaves
  // long-term mould in walls, floors, and insulation — so it's never just a
  // "minor" factor even in isolation. Detect by label since factors[] below
  // uses free-form labels.
  const floodFlagged = factors.some(f => f.label.toLowerCase().includes('flood'));

  // Determine overall risk
  let riskLevel: 'high' | 'moderate' | 'low';
  let riskLabel: string;
  let riskDescription: string;
  if (highCount >= 2 || (highCount >= 1 && modCount >= 2) || floodFlagged) {
    riskLevel = 'high';
    riskLabel = floodFlagged ? 'Higher dampness and flood damage risk' : 'Higher dampness risk';
    riskDescription = floodFlagged
      ? 'Past or potential flooding here leaves long-term damp in walls, floors and insulation. Inspect carefully: behind wardrobes, under sinks, along skirting, in the ceiling space. Ask directly whether the property has been flooded.'
      : 'Multiple factors increase mould and dampness risk here. Inspect carefully before signing.';
  } else if (highCount >= 1 || modCount >= 2) {
    riskLevel = 'moderate';
    riskLabel = 'Some dampness risk';
    riskDescription = 'Some environmental factors could contribute to dampness. Check during your viewing.';
  } else if (modCount >= 1) {
    riskLevel = 'moderate';
    riskLabel = 'Minor dampness factors';
    riskDescription = 'One factor to be aware of, but overall risk is manageable.';
  } else {
    riskLevel = 'low';
    riskLabel = 'Low dampness risk';
    riskDescription = 'No significant environmental factors that increase mould or dampness risk.';
  }

  const STYLES = {
    high: { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200/60 dark:border-red-900/40', icon: 'text-red-500' },
    moderate: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200/60 dark:border-amber-900/40', icon: 'text-amber-500' },
    low: { bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-200/60 dark:border-green-900/40', icon: 'text-green-500' },
  };

  const style = STYLES[riskLevel];

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-4`}>
      <div className="flex items-center gap-2.5 mb-2">
        <Droplets className={`h-5 w-5 ${style.icon}`} />
        <div>
          <p className="text-sm font-bold">{riskLabel}</p>
          <p className="text-xs text-muted-foreground">{riskDescription}</p>
        </div>
      </div>

      {factors.length > 0 && (
        <div className="space-y-1.5 mt-3 mb-3">
          {factors.map((f) => (
            <div key={f.label} className="flex items-start gap-2 text-xs">
              {f.severity === 'high' ? (
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
              )}
              <div>
                <span className="font-medium">{f.label}</span>
                <span className="text-muted-foreground">: {f.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Viewing tips — always show */}
      <div className="border-t border-border/50 pt-2.5 mt-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Eye className="h-3.5 w-3.5 text-piq-primary" />
          <span className="text-xs font-semibold">Check during your viewing</span>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1 ml-5 list-disc">
          <li>Look behind wardrobes and under sinks for mould</li>
          <li>Check bathroom ceilings and window frames for black spots</li>
          <li>Feel the walls: cold spots mean poor insulation</li>
          <li>Open windows to check they stay open (ventilation requirement)</li>
          {riskLevel !== 'low' && <li>Ask about the ground moisture barrier under the floor</li>}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        1 in 5 NZ renters lives in a damp home. Your landlord must provide the property mould-free at the start of tenancy.
      </p>
    </div>
  );
}
