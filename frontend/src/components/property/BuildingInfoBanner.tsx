'use client';

import { useState } from 'react';
import { Info, ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { SiblingValuation } from '@/lib/types';

interface BuildingInfoBannerProps {
  unitCount: number;
  siblingValuations: SiblingValuation[] | null;
  currentValuationId: string | null;
}

const MAX_MINI_TABLE_ROWS = 6;

export function BuildingInfoBanner({
  unitCount,
  siblingValuations,
  currentValuationId,
}: BuildingInfoBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSiblings = siblingValuations && siblingValuations.length >= 2;

  return (
    <div className="flex items-start gap-3 rounded-lg p-3 bg-piq-primary/5">
      <Info className="h-4 w-4 text-piq-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          Unit in a {unitCount}-unit building
        </p>
        <p className="text-xs text-muted-foreground">
          Valuations &amp; rates are for this unit. Risk &amp; neighbourhood data covers the whole building.
        </p>

        {hasSiblings && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-piq-primary mt-1.5 hover:underline"
            >
              <span>Compare {siblingValuations.length} units in this building</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>

            {expanded && (
              <div className="mt-2 rounded border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-1.5 px-2 font-medium">Address</th>
                      <th className="text-right py-1.5 px-2 font-medium">CV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siblingValuations
                      .slice(0, MAX_MINI_TABLE_ROWS)
                      .map((sv) => {
                        const isCurrent = sv.valuation_id === currentValuationId;
                        return (
                          <tr
                            key={sv.valuation_id}
                            className={isCurrent ? 'bg-piq-primary/10 font-semibold' : ''}
                          >
                            <td className="py-1 px-2 truncate max-w-[180px]">
                              {sv.address}
                              {isCurrent && (
                                <span className="text-[10px] text-piq-primary ml-1">(you)</span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-right tabular-nums">
                              {formatCurrency(sv.capital_value)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {siblingValuations.length > MAX_MINI_TABLE_ROWS && (
                  <p className="text-[10px] text-muted-foreground px-2 py-1.5 border-t border-border">
                    {siblingValuations.length - MAX_MINI_TABLE_ROWS} more units — see full comparison below
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
