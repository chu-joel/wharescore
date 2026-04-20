import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BuyerInputs {
  purchasePrice: number;
  depositPct: number;
  interestRate: number;
  loanTerm: 15 | 20 | 25 | 30;
  rates: number | null;       // monthly override
  insurance: number | null;   // monthly override
  utilities: number | null;   // monthly override
  maintenance: number | null; // monthly override
  bodyCorpFee: number | null; // monthly body corp / strata levy
  annualIncome: number | null;
}

export interface RenterInputs {
  weeklyRent: number;
  roomOnly: boolean;
  householdSize: number;
  utilities: number | null;         // monthly override
  contentsInsurance: number | null; // monthly override
  transport: number | null;         // monthly override
  food: number | null;              // monthly override
  annualIncome: number | null;
}

export interface BudgetEntry {
  buyer: BuyerInputs;
  renter: RenterInputs;
  hasInteracted: boolean;
}

interface BudgetState {
  entries: Record<number, BudgetEntry>;
  getEntry: (addressId: number, cv?: number | null, medianRent?: number | null) => BudgetEntry;
  updateBuyer: (addressId: number, partial: Partial<BuyerInputs>) => void;
  updateRenter: (addressId: number, partial: Partial<RenterInputs>) => void;
  /** Sync without flipping hasInteracted. used by parent components to push external inputs. */
  syncRenter: (addressId: number, partial: Partial<RenterInputs>) => void;
  markInteracted: (addressId: number) => void;
}

/**
 * Default owner-occupier floating mortgage rate used when the user hasn't
 * overridden it. Centralised so we only update one number when RBNZ/main
 * bank rates move. previously 6.5 was hard-coded in four places.
 * Last refreshed: 2026-04 (ANZ/ASB/Westpac 1-year fixed ~6.49%).
 */
export const DEFAULT_NZ_MORTGAGE_RATE_PCT = 6.5;

function defaultBuyer(cv?: number | null): BuyerInputs {
  return {
    purchasePrice: cv ?? 800000,
    depositPct: 20,
    interestRate: DEFAULT_NZ_MORTGAGE_RATE_PCT,
    loanTerm: 30,
    rates: null,
    insurance: null,
    utilities: null,
    maintenance: null,
    bodyCorpFee: null,
    annualIncome: null,
  };
}

function defaultRenter(medianRent?: number | null): RenterInputs {
  return {
    weeklyRent: medianRent ?? 500,
    roomOnly: false,
    householdSize: 1,
    utilities: null,
    contentsInsurance: null,
    transport: null,
    food: null,
    annualIncome: null,
  };
}

function defaultEntry(cv?: number | null, medianRent?: number | null): BudgetEntry {
  return {
    buyer: defaultBuyer(cv),
    renter: defaultRenter(medianRent),
    hasInteracted: false,
  };
}

// --- NZ Defaults (Stats NZ HES 2023, adjusted monthly) ---
export const NZ_DEFAULTS = {
  utilities_monthly: 250,
  food_per_person_monthly: 300,
  transport_monthly: 240,
  contents_insurance_monthly: 50,
  maintenance_pct_of_cv: 0.005,
  rates_pct_of_cv: 0.004,
  insurance_base: { auckland: 2200, wellington: 3300, christchurch: 2500, default: 2500 } as Record<string, number>,
  insurance_hazard_add: 500,
  body_corp_default: 350, // typical Wellington apartment body corp monthly
};

// --- Computed helpers ---

export function calcMortgage(price: number, depositPct: number, rate: number, termYears: number): number {
  const loan = price * (1 - depositPct / 100);
  const r = rate / 100 / 12;
  const n = termYears * 12;
  if (r <= 0) return loan / n;
  return loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function buyerMonthly(b: BuyerInputs, hazardCount = 0, city = 'default', isMultiUnit = false): {
  mortgage: number; rates: number; insurance: number; utilities: number; maintenance: number; bodyCorpFee: number; total: number;
} {
  const mortgage = calcMortgage(b.purchasePrice, b.depositPct, b.interestRate, b.loanTerm);
  const rates = b.rates ?? (b.purchasePrice * NZ_DEFAULTS.rates_pct_of_cv / 12);
  const baseIns = NZ_DEFAULTS.insurance_base[city.toLowerCase()] ?? NZ_DEFAULTS.insurance_base.default;
  const insurance = b.insurance ?? ((baseIns + hazardCount * NZ_DEFAULTS.insurance_hazard_add) / 12);
  const utilities = b.utilities ?? NZ_DEFAULTS.utilities_monthly;
  const maintenance = b.maintenance ?? (b.purchasePrice * NZ_DEFAULTS.maintenance_pct_of_cv / 12);
  const bodyCorpFee = isMultiUnit ? (b.bodyCorpFee ?? NZ_DEFAULTS.body_corp_default) : 0;
  return { mortgage, rates, insurance, utilities, maintenance, bodyCorpFee, total: mortgage + rates + insurance + utilities + maintenance + bodyCorpFee };
}

export function renterMonthly(r: RenterInputs): {
  rent: number; utilities: number; insurance: number; transport: number; food: number; total: number;
} {
  const rent = r.weeklyRent * 52 / 12;
  const divisor = r.roomOnly ? r.householdSize : 1;
  const utilities = (r.utilities ?? NZ_DEFAULTS.utilities_monthly) / divisor;
  const insurance = (r.contentsInsurance ?? NZ_DEFAULTS.contents_insurance_monthly) / divisor;
  const transport = r.transport ?? NZ_DEFAULTS.transport_monthly;
  const food = (r.food ?? NZ_DEFAULTS.food_per_person_monthly);
  return { rent, utilities, insurance, transport, food, total: rent + utilities + insurance + transport + food };
}

export function affordabilityRatio(monthlyTotal: number, annualIncome: number | null): number | null {
  if (!annualIncome || annualIncome <= 0) return null;
  return (monthlyTotal / (annualIncome / 12)) * 100;
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      entries: {},

      getEntry: (addressId, cv, medianRent) => {
        const existing = get().entries[addressId];
        if (existing) return existing;
        const entry = defaultEntry(cv, medianRent);
        set((s) => ({ entries: { ...s.entries, [addressId]: entry } }));
        return entry;
      },

      updateBuyer: (addressId, partial) =>
        set((s) => {
          const entry = s.entries[addressId] ?? defaultEntry();
          return {
            entries: {
              ...s.entries,
              [addressId]: { ...entry, buyer: { ...entry.buyer, ...partial }, hasInteracted: true },
            },
          };
        }),

      updateRenter: (addressId, partial) =>
        set((s) => {
          const entry = s.entries[addressId] ?? defaultEntry();
          return {
            entries: {
              ...s.entries,
              [addressId]: { ...entry, renter: { ...entry.renter, ...partial }, hasInteracted: true },
            },
          };
        }),

      // Like updateRenter but does NOT flip hasInteracted. Used for automatic sync
      // from the hosted-report sidebar rent input so the budget slider stays in sync
      // without misreporting user interaction to analytics.
      syncRenter: (addressId, partial) =>
        set((s) => {
          const entry = s.entries[addressId] ?? defaultEntry();
          return {
            entries: {
              ...s.entries,
              [addressId]: { ...entry, renter: { ...entry.renter, ...partial } },
            },
          };
        }),

      markInteracted: (addressId) =>
        set((s) => {
          const entry = s.entries[addressId];
          if (!entry) return s;
          return { entries: { ...s.entries, [addressId]: { ...entry, hasInteracted: true } } };
        }),
    }),
    { name: 'wharescore-budget' },
  ),
);
