'use client';

import { AlertTriangle, CircleDot, Circle } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface ChecklistItem {
  text: string;
  severity: 'critical' | 'important' | 'recommended';
  reason?: string;
}

function getItems(report: PropertyReport): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const h = report.hazards;

  if (h.flood_zone) {
    items.push({ text: 'Check contents insurance covers flood damage', severity: 'critical', reason: 'Property is in a flood zone' });
  }
  if (h.epb_rating || report.planning.epb_listed) {
    items.push({ text: 'Ask landlord about seismic strengthening plans', severity: 'critical', reason: 'Earthquake-prone building' });
  }

  items.push({ text: 'Request insulation statement (legal requirement)', severity: 'important' });
  items.push({ text: 'Verify healthy homes compliance', severity: 'important' });
  items.push({ text: 'Check contents insurance for earthquake/natural hazards', severity: 'important' });
  items.push({ text: 'Test commute at peak times', severity: 'recommended' });
  items.push({ text: 'Check Tenancy Tribunal records for landlord', severity: 'recommended' });
  items.push({ text: 'Visit at different times of day (noise, parking, safety)', severity: 'recommended' });

  return items;
}

const SEVERITY_STYLE = {
  critical: { Icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
  important: { Icon: CircleDot, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  recommended: { Icon: Circle, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
};

export function RenterChecklistContent({ report }: { report: PropertyReport }) {
  const items = getItems(report);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Based on this property's data, here's what to check before signing.
      </p>
      {items.map((item, i) => {
        const style = SEVERITY_STYLE[item.severity];
        const Icon = style.Icon;
        return (
          <div key={i} className={`flex items-start gap-3 rounded-lg ${style.bg} p-3`}>
            <Icon className={`h-4 w-4 ${style.color} shrink-0 mt-0.5`} />
            <div>
              <p className="text-sm font-medium">{item.text}</p>
              {item.reason && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
