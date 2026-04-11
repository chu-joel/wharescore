'use client';

import { useState, useEffect, useRef } from 'react';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, effectivePerUnitCv } from '@/lib/format';
import type { PropertyReport } from '@/lib/types';
import { useBudgetStore, renterMonthly, affordabilityRatio, NZ_DEFAULTS } from '@/stores/budgetStore';
import { BudgetSlider } from './BudgetSlider';
import { BudgetBreakdownChart } from './BudgetBreakdownChart';
import { AffordabilityGauge } from './AffordabilityGauge';
import { useStoreHydrated } from '@/hooks/useStoreHydrated';

interface RenterBudgetCalculatorProps {
  report: PropertyReport;
  /** User-entered weekly rent (from the sidebar input). Seeds the calculator on first view; respected over area median. */
  userRent?: number | null;
}

const SEGMENT_COLORS = {
  rent: '#0D7377',
  utilities: '#3B82F6',
  insurance: '#F59E0B',
  transport: '#8B5CF6',
  food: '#22C55E',
};

function getRentRatioColor(pct: number): string {
  if (pct < 30) return '#22C55E';
  if (pct <= 50) return '#F59E0B';
  return '#EF4444';
}

function getRentRatioMessage(pct: number): string {
  // pct is rent / total monthly expenses, not rent / income, so the
  // thresholds sit higher than the classic 30% affordability rule.
  if (pct < 40) return `${Math.round(pct)}% goes to rent`;
  if (pct <= 55) return `${Math.round(pct)}% goes to rent — tight budget`;
  return `${Math.round(pct)}% goes to rent — over-stretched`;
}

export function RenterBudgetCalculator({ report, userRent }: RenterBudgetCalculatorProps) {
  const addressId = report.address.address_id;
  const medianRent = report.market.rent_assessment?.median ?? null;
  // Seed the calculator with the user's own weekly rent when available. This keeps the
  // "X% goes to rent" ratio aligned with what the user actually pays instead of the
  // area median, which was the complaint in the UX audit.
  const seedRent = (userRent && userRent > 0) ? userRent : medianRent;

  const hydrated = useStoreHydrated();
  const { getEntry, updateRenter, syncRenter } = useBudgetStore();
  // Seed the buyer-side default with a per-unit CV when applicable so a
  // later persona flip doesn't end up with a building-total purchase price.
  const seedCv = effectivePerUnitCv(report.property.capital_value, {
    isMultiUnit: !!report.property_detection?.is_multi_unit,
    unitCount: report.property_detection?.unit_count,
  });
  const entry = getEntry(addressId, seedCv, seedRent);
  const r = entry.renter;

  // If the user later changes the sidebar rent, propagate that into the calculator's
  // slider too — unless the user has already interacted with the calculator directly.
  // syncRenter does NOT flip hasInteracted, so analytics remain accurate.
  useEffect(() => {
    if (!userRent || userRent <= 0) return;
    const current = useBudgetStore.getState().entries[addressId];
    if (!current || current.hasInteracted) return;
    if (current.renter.weeklyRent !== userRent) {
      syncRenter(addressId, { weeklyRent: userRent });
    }
  }, [userRent, addressId, syncRenter]);

  const [overridesOpen, setOverridesOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const sentRef = useRef(false);

  const costs = renterMonthly(r);
  const ratio = affordabilityRatio(costs.total, r.annualIncome);
  const rentPct = costs.total > 0 ? (costs.rent / costs.total) * 100 : 0;

  const segments = [
    { label: 'Rent', amount: costs.rent, color: SEGMENT_COLORS.rent },
    { label: 'Utilities', amount: costs.utilities, color: SEGMENT_COLORS.utilities },
    { label: 'Insurance', amount: costs.insurance, color: SEGMENT_COLORS.insurance },
    { label: 'Transport', amount: costs.transport, color: SEGMENT_COLORS.transport },
    { label: 'Food', amount: costs.food, color: SEGMENT_COLORS.food },
  ];

  // sendBeacon on unmount
  const dataRef = useRef({ r, addressId });
  dataRef.current = { r, addressId };

  useEffect(() => {
    return () => {
      const d = dataRef.current;
      if (!sentRef.current && useBudgetStore.getState().entries[d.addressId]?.hasInteracted) {
        sentRef.current = true;
        const body = JSON.stringify({
          address_id: d.addressId,
          persona: 'renter',
          weekly_rent: d.r.weeklyRent,
          room_only: d.r.roomOnly,
          household_size: d.r.householdSize,
          utilities_override: d.r.utilities,
          contents_insurance_override: d.r.contentsInsurance,
          transport_override: d.r.transport,
          food_override: d.r.food,
          annual_income: d.r.annualIncome,
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/v1/budget-inputs', new Blob([body], { type: 'application/json' }));
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wait for Zustand persist to rehydrate from localStorage before rendering inputs
  if (!hydrated) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 card-elevated space-y-4 animate-pulse">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold">Monthly Budget Calculator</span>
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
        <span className="text-sm font-bold">Monthly Budget Calculator</span>
      </div>

      {/* Total */}
      <div className="text-center">
        <p className="text-3xl font-bold text-piq-primary tabular-nums">
          {formatCurrency(Math.round(costs.total))}
        </p>
        <p className="text-xs text-muted-foreground">/month (estimate)</p>
      </div>

      {/* Rent ratio badge */}
      <div className="flex justify-center">
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: getRentRatioColor(rentPct) }}
        >
          {getRentRatioMessage(rentPct)}
        </span>
      </div>

      {/* Breakdown chart */}
      <BudgetBreakdownChart segments={segments} total={costs.total} />

      {/* Main sliders */}
      <div className="space-y-3 pt-2 border-t border-border">
        <BudgetSlider
          label="Weekly rent"
          value={r.weeklyRent}
          min={50}
          max={2000}
          step={10}
          onChange={(v) => updateRenter(addressId, { weeklyRent: v })}
        />

        {/* Room-only toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={r.roomOnly}
            onChange={(e) => updateRenter(addressId, {
              roomOnly: e.target.checked,
              householdSize: e.target.checked && r.householdSize < 2 ? 3 : r.householdSize,
            })}
            className="accent-piq-primary"
          />
          <span className="text-xs text-muted-foreground">I&apos;m renting a room</span>
        </label>

        {r.roomOnly && (
          <BudgetSlider
            label="Household size"
            value={r.householdSize}
            min={1}
            max={8}
            step={1}
            format="number"
            suffix={r.householdSize === 1 ? ' person' : ' people'}
            onChange={(v) => updateRenter(addressId, { householdSize: v })}
          />
        )}
      </div>

      {/* Expandable overrides */}
      <div className="border-t border-border pt-2">
        <button
          onClick={() => setOverridesOpen(!overridesOpen)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {overridesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Adjust estimates
          {r.roomOnly && <span className="ml-auto text-xs">Shared costs split by {r.householdSize}</span>}
        </button>

        {overridesOpen && (
          <div className="mt-3 space-y-3">
            <BudgetSlider
              label={`Utilities/mo${r.roomOnly ? ` (÷${r.householdSize})` : ''}`}
              value={r.utilities ?? NZ_DEFAULTS.utilities_monthly}
              min={0}
              max={600}
              step={10}
              onChange={(v) => updateRenter(addressId, { utilities: v })}
            />
            <BudgetSlider
              label={`Contents ins./mo${r.roomOnly ? ` (÷${r.householdSize})` : ''}`}
              value={r.contentsInsurance ?? NZ_DEFAULTS.contents_insurance_monthly}
              min={0}
              max={200}
              step={5}
              onChange={(v) => updateRenter(addressId, { contentsInsurance: v })}
            />
            <BudgetSlider
              label="Transport/mo"
              value={r.transport ?? NZ_DEFAULTS.transport_monthly}
              min={0}
              max={600}
              step={10}
              onChange={(v) => updateRenter(addressId, { transport: v })}
            />
            <BudgetSlider
              label="Food/mo"
              value={r.food ?? NZ_DEFAULTS.food_per_person_monthly}
              min={0}
              max={1200}
              step={20}
              onChange={(v) => updateRenter(addressId, { food: v })}
            />
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
              value={r.annualIncome ?? 65000}
              min={20000}
              max={500000}
              step={5000}
              onChange={(v) => updateRenter(addressId, { annualIncome: v })}
            />
            {ratio !== null && <AffordabilityGauge ratio={ratio} />}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Based on Stats NZ averages. {r.roomOnly ? 'Shared costs divided by household size.' : ''} Adjust to match your situation.
      </p>
    </div>
  );
}

// --- Override input ---

function OverrideInput({
  label,
  value,
  defaultValue,
  displayValue,
  isShared,
  onChange,
}: {
  label: string;
  value: number | null;
  defaultValue: number;
  displayValue?: number;
  isShared?: boolean;
  onChange: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const shown = displayValue ?? (value ?? defaultValue);

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
            placeholder={`$${defaultValue} (total)`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-24">{label}</span>
      <span className="flex-1 text-xs font-medium tabular-nums">
        {formatCurrency(shown)}/mo
        {isShared && <span className="text-muted-foreground ml-1 text-xs">(your share)</span>}
        {value !== null && <span className="text-piq-primary ml-1 text-xs">(custom)</span>}
      </span>
      <button
        onClick={() => { setInputVal(String(value ?? defaultValue)); setEditing(true); }}
        className="text-xs text-piq-primary hover:underline"
      >
        edit
      </button>
    </div>
  );
}
