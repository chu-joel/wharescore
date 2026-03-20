'use client';

import { Activity } from 'lucide-react';
import type { HazardData } from '@/lib/types';

interface EarthquakeDetailCardProps {
  hazards: HazardData;
}

function gradeLabel(grade: number): string {
  if (grade <= 1) return 'Very Low';
  if (grade <= 2) return 'Low';
  if (grade <= 3) return 'Moderate';
  if (grade <= 4) return 'High';
  return 'Very High';
}

function gradeColor(grade: number): string {
  if (grade <= 1) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (grade <= 2) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (grade <= 3) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  if (grade <= 4) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
}

export function EarthquakeDetailCard({ hazards }: EarthquakeDetailCardProps) {
  const {
    earthquake_hazard_index,
    earthquake_hazard_grade,
    ground_shaking_zone,
    ground_shaking_severity,
    fault_zone_name,
    fault_zone_ranking,
  } = hazards;

  // Return null if no earthquake detail fields are available
  const hasAny =
    earthquake_hazard_index != null ||
    earthquake_hazard_grade != null ||
    ground_shaking_zone != null ||
    fault_zone_name != null;

  if (!hasAny) return null;

  const rows: { label: string; value: React.ReactNode }[] = [];

  if (earthquake_hazard_grade != null) {
    const label = gradeLabel(earthquake_hazard_grade);
    const color = gradeColor(earthquake_hazard_grade);
    rows.push({
      label: 'Hazard Grade',
      value: (
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}>
          {label}
        </span>
      ),
    });
  }

  if (ground_shaking_severity != null) {
    // severity is like "1 Low", "3 Moderate", "5 High" — use it directly
    rows.push({ label: 'Ground Shaking', value: ground_shaking_severity });
  } else if (ground_shaking_zone != null) {
    const zoneLabels: Record<string, string> = { '1': 'Low', '2': 'Low–Moderate', '3': 'Moderate', '4': 'Moderate–High', '5': 'High' };
    rows.push({ label: 'Ground Shaking', value: zoneLabels[ground_shaking_zone] ?? `Zone ${ground_shaking_zone}` });
  }

  if (fault_zone_name != null) {
    let display = fault_zone_name;
    if (fault_zone_ranking) {
      display += ` — ${fault_zone_ranking}`;
    }
    rows.push({ label: 'Nearest Fault', value: display });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30">
          <Activity className="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
        <span className="text-sm font-bold">Seismic Profile</span>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2 mb-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <span className="text-sm font-medium text-right">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hazard index gauge — CHI (Combined Hazard Index), typically 0–20,000+ */}
      {earthquake_hazard_index != null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Hazard Index (CHI)</span>
            <span className="text-xs font-medium">{Math.round(earthquake_hazard_index).toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500"
              style={{ width: `${Math.min(100, (earthquake_hazard_index / 15000) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      )}
    </div>
  );
}
