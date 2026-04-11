'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { formatCurrency, effectivePerUnitCv } from '@/lib/format';
import { DEFAULT_NZ_MORTGAGE_RATE_PCT } from '@/stores/budgetStore';
import type { PropertyReport } from '@/lib/types';

interface MonthlyCostEstimateProps {
  report: PropertyReport;
}

export function MonthlyCostEstimate({ report }: MonthlyCostEstimateProps) {
  // Per-unit CV when the raw value looks like a whole-building total —
  // prevents the mortgage calc from returning numbers like $469k/month on
  // multi-unit apartment complexes where only a building-total CV exists.
  const cv = effectivePerUnitCv(report.property.capital_value, {
    isMultiUnit: !!report.property_detection?.is_multi_unit,
    unitCount: report.property_detection?.unit_count,
  });
  if (!cv) return null;

  const [depositPct, setDepositPct] = useState(20);
  const [interestRate, setInterestRate] = useState(DEFAULT_NZ_MORTGAGE_RATE_PCT);

  const purchasePrice = cv; // Using CV as proxy
  const loanAmount = purchasePrice * (1 - depositPct / 100);

  // Monthly mortgage (P&I, 30 year term)
  const monthlyRate = interestRate / 100 / 12;
  const nPayments = 30 * 12;
  const mortgage = monthlyRate > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, nPayments)) /
      (Math.pow(1 + monthlyRate, nPayments) - 1)
    : loanAmount / nPayments;

  // Estimated council rates (~0.3-0.5% of CV p.a. for Wellington)
  const annualRates = cv * 0.004;
  const monthlyRates = annualRates / 12;

  // Estimated insurance (~$150-250/month for Wellington)
  const monthlyInsurance = 180;

  const totalMonthly = mortgage + monthlyRates + monthlyInsurance;

  const segments = [
    { label: 'Mortgage', amount: mortgage, color: '#0D7377' },
    { label: 'Rates', amount: monthlyRates, color: '#D4863B' },
    { label: 'Insurance', amount: monthlyInsurance, color: '#6B7280' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-bold">Estimated Monthly Cost</span>
      </div>

      {/* Total */}
      <div className="text-center">
        <p className="text-3xl font-bold text-piq-primary tabular-nums">
          {formatCurrency(Math.round(totalMonthly))}
        </p>
        <p className="text-xs text-muted-foreground">/month (estimate)</p>
      </div>

      {/* Donut-style bar breakdown */}
      <div className="space-y-2">
        {segments.map((seg) => {
          const pct = (seg.amount / totalMonthly) * 100;
          return (
            <div key={seg.label} className="flex items-center gap-3">
              <div className="w-20 text-xs text-muted-foreground">{seg.label}</div>
              <div className="flex-1 h-3 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: seg.color }}
                />
              </div>
              <div className="w-16 text-right text-xs font-medium tabular-nums">
                {formatCurrency(Math.round(seg.amount))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive sliders */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Deposit</label>
            <span className="text-xs font-medium">{depositPct}% ({formatCurrency(Math.round(cv * depositPct / 100))})</span>
          </div>
          <input
            type="range"
            min={10}
            max={40}
            step={5}
            value={depositPct}
            onChange={(e) => setDepositPct(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-muted/60 accent-piq-primary cursor-pointer"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Interest rate</label>
            <span className="text-xs font-medium">{interestRate.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min={4}
            max={9}
            step={0.25}
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-muted/60 accent-piq-primary cursor-pointer"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Based on valuation of {formatCurrency(cv)}. 30yr P&I mortgage. Rates and insurance are estimates.
      </p>
    </div>
  );
}
