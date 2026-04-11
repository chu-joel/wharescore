'use client';

import { AlertTriangle, CircleDot, Circle } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface ChecklistItem {
  text: string;
  severity: 'critical' | 'important' | 'recommended';
  reason?: string;
  estimatedCost?: string;
}

function getItems(report: PropertyReport): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const h = report.hazards;
  const p = report.planning;

  // Critical — driven by report data
  if (h.flood_zone) {
    items.push({ text: 'Get flood risk assessment', severity: 'critical', reason: `Property is in flood zone: ${h.flood_zone}`, estimatedCost: '$500–$2,000' });
  }
  if (p.epb_listed || h.epb_rating) {
    items.push({ text: 'Request seismic assessment', severity: 'critical', reason: 'Building is earthquake-prone', estimatedCost: '$2,000–$10,000' });
  }
  if (h.slope_failure?.toLowerCase().includes('high') || h.landslide_in_area) {
    items.push({ text: 'Commission geotechnical report', severity: 'critical', reason: 'High slope failure risk or mapped landslide area', estimatedCost: '$3,000–$8,000' });
  }
  const contaminationCount = p.contamination_count ?? h.contamination_count ?? 0;
  if (contaminationCount >= 3) {
    items.push({ text: 'Check contaminated land register (HAIL/SLUR)', severity: 'critical', reason: `${contaminationCount} HAIL sites within 500m` });
  }

  // Important — always include
  items.push({ text: 'Get building inspection', severity: 'important', estimatedCost: '$400–$800' });
  items.push({ text: 'Order LIM report from council', severity: 'important', estimatedCost: '$300–$500' });
  items.push({ text: 'Review title and any encumbrances', severity: 'important' });
  items.push({ text: 'Check insurance availability and premiums', severity: 'important' });

  // Recommended
  if (p.heritage_count && p.heritage_count > 0) {
    items.push({ text: 'Check heritage restrictions and consent requirements', severity: 'recommended', reason: `${p.heritage_count} heritage items nearby` });
  }
  items.push({ text: 'Verify rates and any special levies', severity: 'recommended' });
  items.push({ text: 'Check planned infrastructure and road changes', severity: 'recommended' });

  return items;
}

const SEVERITY_STYLE = {
  critical: { Icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', label: 'Critical' },
  important: { Icon: CircleDot, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', label: 'Important' },
  recommended: { Icon: Circle, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', label: 'Recommended' },
};

export function BuyerChecklistContent({ report }: { report: PropertyReport }) {
  const items = getItems(report);
  const criticalCount = items.filter(i => i.severity === 'critical').length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        {criticalCount > 0
          ? `${criticalCount} critical item${criticalCount > 1 ? 's' : ''} based on this property's risk profile.`
          : 'Standard due diligence items for this property.'}
      </p>
      {items.map((item, i) => {
        const style = SEVERITY_STYLE[item.severity];
        const Icon = style.Icon;
        return (
          <div key={i} className={`flex items-start gap-3 rounded-lg ${style.bg} p-3`}>
            <Icon className={`h-4 w-4 ${style.color} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{item.text}</p>
                {item.estimatedCost && (
                  <span className="text-xs text-muted-foreground shrink-0">{item.estimatedCost}</span>
                )}
              </div>
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
