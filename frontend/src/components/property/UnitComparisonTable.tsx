'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, Home } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { SiblingValuation } from '@/lib/types';

interface UnitComparisonTableProps {
  siblingValuations: SiblingValuation[];
  currentValuationId: string | null;
  currentProperty: {
    cv_address: string | null;
    capital_value: number | null;
    land_value: number | null;
    cv_valuation_id: string | null;
  };
}

type SortField = 'capital_value' | 'land_value';
type SortDir = 'asc' | 'desc';

export function UnitComparisonTable({
  siblingValuations,
  currentValuationId,
  currentProperty,
}: UnitComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>('capital_value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Ensure current unit is in the list
  const allUnits = useMemo(() => {
    const hasCurrentInList = siblingValuations.some(
      (sv) => sv.valuation_id === currentValuationId
    );
    if (hasCurrentInList || !currentProperty.capital_value) return siblingValuations;
    // Prepend synthetic row for current unit
    return [
      {
        address: currentProperty.cv_address ?? 'Current unit',
        capital_value: currentProperty.capital_value,
        land_value: currentProperty.land_value ?? 0,
        valuation_id: currentProperty.cv_valuation_id ?? '__current',
      },
      ...siblingValuations,
    ];
  }, [siblingValuations, currentValuationId, currentProperty]);

  // Sort: current unit always pinned to top, rest sorted
  const sorted = useMemo(() => {
    const current = allUnits.find((u) => u.valuation_id === currentValuationId);
    const rest = allUnits
      .filter((u) => u.valuation_id !== currentValuationId)
      .sort((a, b) => {
        const av = a[sortField];
        const bv = b[sortField];
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    return current ? [current, ...rest] : rest;
  }, [allUnits, currentValuationId, sortField, sortDir]);

  // Min/max for relative bars
  const maxCV = Math.max(...allUnits.map((u) => u.capital_value));
  const minCV = Math.min(...allUnits.map((u) => u.capital_value));
  const cvRange = maxCV - minCV || 1;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3 inline ml-0.5" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-0.5" />
    );
  };

  if (allUnits.length < 2) return null;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <span className="text-sm font-semibold">Units in this building</span>
        <Badge variant="secondary" className="text-xs">
          {allUnits.length} units
        </Badge>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left py-2 px-3 font-medium">Address</th>
              <th
                className="text-right py-2 px-3 font-medium cursor-pointer hover:text-piq-primary"
                onClick={() => toggleSort('capital_value')}
              >
                Capital Value <SortIcon field="capital_value" />
              </th>
              <th
                className="text-right py-2 px-3 font-medium cursor-pointer hover:text-piq-primary"
                onClick={() => toggleSort('land_value')}
              >
                Land Value <SortIcon field="land_value" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((unit) => {
              const isCurrent = unit.valuation_id === currentValuationId;
              const barWidth = ((unit.capital_value - minCV) / cvRange) * 100;
              return (
                <tr
                  key={unit.valuation_id}
                  className={isCurrent ? 'bg-piq-primary/10' : 'hover:bg-muted/30'}
                >
                  <td className="py-1.5 px-3 truncate max-w-[200px]">
                    <span className="flex items-center gap-1.5">
                      {isCurrent && <Home className="h-3.5 w-3.5 text-piq-primary shrink-0" />}
                      <span>{unit.address}</span>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-[9px] ml-1">This unit</Badge>
                      )}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isCurrent ? 'bg-piq-accent-warm' : 'bg-piq-primary/30'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(unit.capital_value)}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(unit.land_value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border">
        {sorted.map((unit) => {
          const isCurrent = unit.valuation_id === currentValuationId;
          const barWidth = ((unit.capital_value - minCV) / cvRange) * 100;
          return (
            <div
              key={unit.valuation_id}
              className={`p-3 ${isCurrent ? 'bg-piq-primary/10' : ''}`}
            >
              <div className="flex items-center gap-1.5 text-sm mb-1">
                {isCurrent && <Home className="h-3.5 w-3.5 text-piq-primary" />}
                <span className="truncate">{unit.address}</span>
                {isCurrent && (
                  <Badge variant="secondary" className="text-[9px]">This unit</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">CV: </span>
                  <span className="font-semibold tabular-nums">{formatCurrency(unit.capital_value)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">LV: </span>
                  <span className="tabular-nums">{formatCurrency(unit.land_value)}</span>
                </div>
              </div>
              <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${isCurrent ? 'bg-piq-accent-warm' : 'bg-piq-primary/30'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {allUnits.length >= 20 && (
        <p className="text-xs text-muted-foreground px-3 py-1.5 border-t border-border">
          Showing first 20 units
        </p>
      )}
    </div>
  );
}
