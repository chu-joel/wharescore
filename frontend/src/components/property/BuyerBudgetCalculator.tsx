'use client';

import { useState, useEffect, useRef } from 'react';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { PropertyReport } from '@/lib/types';
import { useBudgetStore, buyerMonthly, affordabilityRatio, NZ_DEFAULTS } from '@/stores/budgetStore';
import { BudgetSlider } from './BudgetSlider';
import { BudgetBreakdownChart } from './BudgetBreakdownChart';
import { AffordabilityGauge } from './AffordabilityGauge';
import { useStoreHydrated } from '@/hooks/useStoreHydrated';

interface BuyerBudgetCalculatorProps {
  report: PropertyReport;
}

const LOAN_TERMS = [15, 20, 25, 30] as const;

const SEGMENT_COLORS = {
  mortgage: '#0D7377',
  rates: '#3B82F6',
  insurance: '#F59E0B',
  utilities: '#8B5CF6',
  maintenance: '#6B7280',
  bodyCorp: '#EC4899',
};

function countHazards(report: PropertyReport): number {
  const h = report.hazards;
  let count = 0;
  if (h.flood_zone) count++;
  if (h.landslide_in_area) count++;
  if (h.tsunami_zone) count++;
  if (h.slope_failure?.toLowerCase().includes('high')) count++;
  if (h.coastal_erosion?.toLowerCase().includes('high')) count++;
  return count;
}

function detectCity(report: PropertyReport): string {
  const city = report.address.city?.toLowerCase() ?? '';
  if (city.includes('auckland')) return 'auckland';
  if (city.includes('wellington') || city.includes('lower hutt') || city.includes('upper hutt') || city.includes('porirua')) return 'wellington';
  if (city.includes('christchurch')) return 'christchurch';
  return 'default';
}

export function BuyerBudgetCalculator({ report }: BuyerBudgetCalculatorProps) {
  const cv = report.property.capital_value;
  const addressId = report.address.address_id;
  const hazardCount = countHazards(report);
  const city = detectCity(report);
  const isMultiUnit = !!report.property_detection?.is_multi_unit;
  const unitCount = report.property_detection?.unit_count ?? 1;

  // For multi-unit, estimate per-unit CV if the CV looks like a whole-building value
  const estimatedUnitCv = (isMultiUnit && cv && unitCount > 1) ? Math.round(cv / unitCount) : cv;

  const hydrated = useStoreHydrated();
  const { getEntry, updateBuyer } = useBudgetStore();
  const entry = getEntry(addressId, estimatedUnitCv);
  const b = entry.buyer;

  const [overridesOpen, setOverridesOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const sentRef = useRef(false);

  const costs = buyerMonthly(b, hazardCount, city, isMultiUnit);
  const ratio = affordabilityRatio(costs.total, b.annualIncome);

  const segments = [
    { label: 'Mortgage', amount: costs.mortgage, color: SEGMENT_COLORS.mortgage },
    { label: 'Rates', amount: costs.rates, color: SEGMENT_COLORS.rates },
    { label: 'Insurance', amount: costs.insurance, color: SEGMENT_COLORS.insurance },
    { label: 'Utilities', amount: costs.utilities, color: SEGMENT_COLORS.utilities },
    { label: 'Maintenance', amount: costs.maintenance, color: SEGMENT_COLORS.maintenance },
    ...(isMultiUnit ? [{ label: 'Body Corp', amount: costs.bodyCorpFee, color: SEGMENT_COLORS.bodyCorp }] : []),
  ];

  // sendBeacon on unmount
  const dataRef = useRef({ b, addressId, hazardCount, city });
  dataRef.current = { b, addressId, hazardCount, city };

  useEffect(() => {
    return () => {
      const d = dataRef.current;
      if (!sentRef.current && useBudgetStore.getState().entries[d.addressId]?.hasInteracted) {
        sentRef.current = true;
        const body = JSON.stringify({
          address_id: d.addressId,
          persona: 'buyer',
          purchase_price: d.b.purchasePrice,
          deposit_pct: d.b.depositPct,
          interest_rate: d.b.interestRate,
          loan_term: d.b.loanTerm,
          rates_override: d.b.rates,
          insurance_override: d.b.insurance,
          utilities_override: d.b.utilities,
          maintenance_override: d.b.maintenance,
          annual_income: d.b.annualIncome,
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/v1/budget-inputs', new Blob([body], { type: 'application/json' }));
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cv) return null;

  // Wait for Zustand persist to rehydrate from localStorage before rendering inputs
  if (!hydrated) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 card-elevated space-y-4 animate-pulse">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold">Monthly Cost Calculator</span>
        </div>
        <div className="h-10 bg-muted/40 rounded" />
        <div className="h-24 bg-muted/40 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-bold">Monthly Cost Calculator</span>
      </div>

      {/* Total */}
      <div className="text-center">
        <p className="text-3xl font-bold text-piq-primary tabular-nums">
          {formatCurrency(Math.round(costs.total))}
        </p>
        <p className="text-xs text-muted-foreground">/month (estimate)</p>
      </div>

      {/* Breakdown chart */}
      <BudgetBreakdownChart segments={segments} total={costs.total} />

      {/* Main sliders */}
      <div className="space-y-3 pt-2 border-t border-border">
        <BudgetSlider
          label="Purchase price"
          value={b.purchasePrice}
          min={100000}
          max={5000000}
          step={10000}
          onChange={(v) => updateBuyer(addressId, { purchasePrice: v })}
        />
        <BudgetSlider
          label="Deposit"
          value={b.depositPct}
          min={5}
          max={50}
          step={5}
          format="percent"
          onChange={(v) => updateBuyer(addressId, { depositPct: v })}
        />
        <BudgetSlider
          label="Interest rate"
          value={b.interestRate}
          min={3}
          max={10}
          step={0.25}
          format="percent"
          onChange={(v) => updateBuyer(addressId, { interestRate: v })}
        />

        {/* Loan term pill selector */}
        <div>
          <label className="text-xs text-muted-foreground">Loan term</label>
          <div className="flex gap-1.5 mt-1">
            {LOAN_TERMS.map((term) => (
              <button
                key={term}
                onClick={() => updateBuyer(addressId, { loanTerm: term })}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                  b.loanTerm === term
                    ? 'bg-piq-primary text-white'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {term}yr
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expandable overrides */}
      <div className="border-t border-border pt-2">
        <button
          onClick={() => setOverridesOpen(!overridesOpen)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {overridesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Adjust estimates
        </button>

        {overridesOpen && (
          <div className="mt-3 space-y-3">
            <BudgetSlider
              label="Rates/mo"
              value={b.rates ?? Math.round(b.purchasePrice * NZ_DEFAULTS.rates_pct_of_cv / 12)}
              min={0}
              max={1000}
              step={10}
              onChange={(v) => updateBuyer(addressId, { rates: v })}
            />
            <BudgetSlider
              label="Insurance/mo"
              value={b.insurance ?? Math.round(
                ((NZ_DEFAULTS.insurance_base[city] ?? NZ_DEFAULTS.insurance_base.default) +
                  hazardCount * NZ_DEFAULTS.insurance_hazard_add) / 12
              )}
              min={0}
              max={800}
              step={10}
              onChange={(v) => updateBuyer(addressId, { insurance: v })}
            />
            <BudgetSlider
              label="Utilities/mo"
              value={b.utilities ?? NZ_DEFAULTS.utilities_monthly}
              min={0}
              max={600}
              step={10}
              onChange={(v) => updateBuyer(addressId, { utilities: v })}
            />
            <BudgetSlider
              label="Maintenance/mo"
              value={b.maintenance ?? Math.round(b.purchasePrice * NZ_DEFAULTS.maintenance_pct_of_cv / 12)}
              min={0}
              max={800}
              step={10}
              onChange={(v) => updateBuyer(addressId, { maintenance: v })}
            />
            {isMultiUnit && (
              <BudgetSlider
                label="Body corp/mo"
                value={b.bodyCorpFee ?? NZ_DEFAULTS.body_corp_default}
                min={50}
                max={1500}
                step={25}
                onChange={(v) => updateBuyer(addressId, { bodyCorpFee: v })}
              />
            )}
          </div>
        )}
      </div>

      {/* Income + affordability */}
      <div className="border-t border-border pt-2">
        <button
          onClick={() => setIncomeOpen(!incomeOpen)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {incomeOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Your income (optional)
        </button>

        {incomeOpen && (
          <div className="mt-3 space-y-3">
            <BudgetSlider
              label="Annual income"
              value={b.annualIncome ?? 100000}
              min={20000}
              max={500000}
              step={5000}
              onChange={(v) => updateBuyer(addressId, { annualIncome: v })}
            />
            {ratio !== null && <AffordabilityGauge ratio={ratio} />}
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        {isMultiUnit && unitCount > 1
          ? `Building CV ${formatCurrency(cv!)} ÷ ${unitCount} units ≈ ${formatCurrency(estimatedUnitCv!)} per unit (estimate). `
          : `Based on CV of ${formatCurrency(cv!)}. `}
        P&I mortgage. Rates, insurance{isMultiUnit ? ', body corp' : ''} &amp; utilities are estimates — adjust sliders to match.
      </p>
    </div>
  );
}

// --- Override input with edit capability ---

function OverrideInput({
  label,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  value: number | null;
  defaultValue: number;
  onChange: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const displayValue = value ?? defaultValue;

  const handleSave = () => {
    const parsed = parseInt(inputVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-24">{label}</span>
        <div className="flex-1 flex gap-1">
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={handleSave}
            className="flex-1 h-7 px-2 text-xs rounded border border-border bg-background"
            placeholder={`$${defaultValue}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-24">{label}</span>
      <span className="flex-1 text-xs font-medium tabular-nums">
        {formatCurrency(displayValue)}/mo
        {value !== null && <span className="text-piq-primary ml-1 text-[10px]">(custom)</span>}
      </span>
      <button
        onClick={() => { setInputVal(String(displayValue)); setEditing(true); }}
        className="text-[10px] text-piq-primary hover:underline"
      >
        edit
      </button>
    </div>
  );
}
