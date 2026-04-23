'use client';

import { Shield, AlertTriangle, CircleCheck, CircleMinus } from 'lucide-react';
import type { PropertyReport, ReportSnapshot } from '@/lib/types';
import { isInFloodZone } from '@/lib/hazards';

interface Props {
  report: PropertyReport;
  snapshot?: ReportSnapshot;
}

interface HazardItem {
  label: string;
  status: 'clear' | 'watch' | 'concern';
}

const STATUS_STYLES = {
  clear: { Icon: CircleCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20', label: 'Clear' },
  watch: { Icon: CircleMinus, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20', label: 'Watch' },
  concern: { Icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/20', label: 'Concern' },
};

export function QuickHazardSummary({ report, snapshot }: Props) {
  const h = report.hazards;
  if (!h) return null;

  // Coastal: prefer the SeaRise-backed timeline tier if we have it.
  // Dev override: ?mockCoastal=1 injects a fake happens_now tier so the UI
  // can be previewed. Gated to non-production so prod users never see fake data.
  const useMock = process.env.NODE_ENV !== 'production'
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('mockCoastal') === '1';
  const coastal = useMock
    ? { tier: 'happens_now' as const }
    : snapshot?.coastal;
  const coastalStatus: HazardItem['status'] = coastal && coastal.tier !== 'not_applicable'
    ? (coastal.tier === 'happens_now' ? 'concern' : coastal.tier === 'within_30_years' ? 'watch' : 'clear')
    : (h.coastal_erosion ? 'concern' : 'clear');

  const items: HazardItem[] = [
    { label: 'Flooding', status: isInFloodZone(h) ? 'concern' : 'clear' },
    { label: 'Earthquake', status: (h.epb_count && h.epb_count > 0) ? 'concern' : h.liquefaction_zone ? 'watch' : 'clear' },
    { label: 'Tsunami', status: h.tsunami_zone ? 'concern' : 'clear' },
    { label: 'Slope / Landslide', status: h.slope_failure ? 'concern' : 'clear' },
    { label: 'Coastal & sea level', status: coastalStatus },
    { label: 'Wildfire', status: h.wildfire_risk ? 'watch' : 'clear' },
    { label: 'Contamination', status: (h.contamination_count && h.contamination_count > 0) ? 'concern' : 'clear' },
  ];

  // Only show hazards that exist (have data). always show flooding + earthquake
  const watchCount = items.filter(i => i.status === 'watch').length;
  const concernCount = items.filter(i => i.status === 'concern').length;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Shield className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">Hazard Summary</h3>
        {concernCount > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs font-medium">
            {concernCount} concern{concernCount !== 1 ? 's' : ''}
          </span>
        )}
        {concernCount === 0 && watchCount > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
            {watchCount} to watch
          </span>
        )}
        {concernCount === 0 && watchCount === 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
            All clear
          </span>
        )}
      </div>
      <div className="px-5 pb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((item) => {
            const style = STATUS_STYLES[item.status];
            return (
              <div key={item.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${style.bg}`}>
                <style.Icon className={`h-4 w-4 shrink-0 ${style.color}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
