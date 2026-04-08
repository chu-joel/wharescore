'use client';

import { useState } from 'react';
import { FileText, Loader2, ChevronDown, Sparkles, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { usePersonaStore } from '@/stores/personaStore';
import { useRentInputStore } from '@/stores/rentInputStore';
import { useBuyerInputStore } from '@/stores/buyerInputStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { create } from 'zustand';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import type { PropertyReport } from '@/lib/types';

/* ── Store ──────────────────────────────────────────────── */
interface ReportConfirmState {
  open: boolean;
  addressId: number | null;
  selectedTier: 'quick' | 'full';
  onConfirm: ((tier: 'quick' | 'full') => void) | null;
  show: (addressId: number, onConfirm: (tier: 'quick' | 'full') => void) => void;
  close: () => void;
  setSelectedTier: (tier: 'quick' | 'full') => void;
}

export const useReportConfirmStore = create<ReportConfirmState>((set) => ({
  open: false,
  addressId: null,
  selectedTier: 'quick',
  onConfirm: null,
  show: (addressId, onConfirm) => set({ open: true, addressId, onConfirm }),
  close: () => set({ open: false, onConfirm: null }),
  setSelectedTier: (tier) => set({ selectedTier: tier }),
}));

/* ── Options ────────────────────────────────────────────── */
const DWELLING_TYPES = ['House', 'Flat', 'Apartment', 'Room'] as const;
const BEDROOM_OPTIONS = ['Studio', '1', '2', '3', '4', '5+'] as const;
const FINISH_TIERS = [
  { value: 'basic', label: 'Basic', desc: 'Dated kitchen/bathroom, older carpets' },
  { value: 'standard', label: 'Standard', desc: 'Clean and tidy, no frills' },
  { value: 'modern', label: 'Modern', desc: 'Recently renovated, good fixtures' },
  { value: 'premium', label: 'Premium', desc: 'High-end finishes, designer kitchen' },
  { value: 'luxury', label: 'Luxury', desc: 'Architect-designed, top-of-the-line' },
] as const;
const BATHROOM_OPTIONS = ['1', '2', '3+'] as const;
const LOAN_TERMS = [15, 20, 25, 30] as const;

/* ── Pill button ────────────────────────────────────────── */
function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors min-h-[36px] flex items-center ${
        selected
          ? 'bg-piq-primary text-white border-piq-primary'
          : 'border-border text-foreground hover:border-piq-primary hover:text-piq-primary'
      }`}
    >
      {children}
    </button>
  );
}

/* ── Number input ───────────────────────────────────────── */
function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>
        )}
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-border bg-background py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-piq-primary/50 ${
            prefix ? 'pl-6 pr-2' : 'pl-2.5 pr-2'
          } ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

/* ── Renter Fields ──────────────────────────────────────── */
function RenterFields({ addressId }: { addressId: number }) {
  const dwellingType = useRentInputStore((s) => s.dwellingType);
  const bedrooms = useRentInputStore((s) => s.bedrooms);
  const weeklyRent = useRentInputStore((s) => s.weeklyRent);
  const finishTier = useRentInputStore((s) => s.finishTier);
  const bathrooms = useRentInputStore((s) => s.bathrooms);
  const hasParking = useRentInputStore((s) => s.hasParking);
  const isFurnished = useRentInputStore((s) => s.isFurnished);
  const isPartiallyFurnished = useRentInputStore((s) => s.isPartiallyFurnished);
  const hasOutdoorSpace = useRentInputStore((s) => s.hasOutdoorSpace);
  const isCharacterProperty = useRentInputStore((s) => s.isCharacterProperty);
  const sharedKitchen = useRentInputStore((s) => s.sharedKitchen);
  const utilitiesIncluded = useRentInputStore((s) => s.utilitiesIncluded);
  const setDwellingType = useRentInputStore((s) => s.setDwellingType);
  const setBedrooms = useRentInputStore((s) => s.setBedrooms);
  const setWeeklyRent = useRentInputStore((s) => s.setWeeklyRent);
  const setFinishTier = useRentInputStore((s) => s.setFinishTier);
  const setBathrooms = useRentInputStore((s) => s.setBathrooms);
  const setHasParking = useRentInputStore((s) => s.setHasParking);
  const setIsFurnished = useRentInputStore((s) => s.setIsFurnished);
  const setIsPartiallyFurnished = useRentInputStore((s) => s.setIsPartiallyFurnished);
  const setHasOutdoorSpace = useRentInputStore((s) => s.setHasOutdoorSpace);
  const setIsCharacterProperty = useRentInputStore((s) => s.setIsCharacterProperty);
  const setSharedKitchen = useRentInputStore((s) => s.setSharedKitchen);
  const setUtilitiesIncluded = useRentInputStore((s) => s.setUtilitiesIncluded);

  const entry = useBudgetStore((s) => s.entries[addressId]);
  const updateRenter = useBudgetStore((s) => s.updateRenter);
  const r = entry?.renter;
  const [showBudget, setShowBudget] = useState(false);

  return (
    <div className="space-y-3">
      {/* Property type (required) */}
      <div className={!dwellingType ? 'rounded-lg border-2 border-dashed border-piq-primary/40 p-2 -m-2 bg-piq-primary/5' : ''}>
        <label className="text-xs text-muted-foreground mb-1.5 block">Property type <span className="text-risk-high">*</span></label>
        <div className="flex flex-wrap gap-1.5">
          {DWELLING_TYPES.map((dt) => (
            <Pill key={dt} selected={dwellingType === dt} onClick={() => setDwellingType(dt)}>
              {dt}
            </Pill>
          ))}
        </div>
      </div>

      {/* Bedrooms (required) */}
      <div className={!bedrooms ? 'rounded-lg border-2 border-dashed border-piq-primary/40 p-2 -m-2 bg-piq-primary/5' : ''}>
        <label className="text-xs text-muted-foreground mb-1.5 block">Bedrooms <span className="text-risk-high">*</span></label>
        <div className="flex flex-wrap gap-1.5">
          {BEDROOM_OPTIONS.map((b) => (
            <Pill key={b} selected={bedrooms === b} onClick={() => setBedrooms(b)}>
              {b}
            </Pill>
          ))}
        </div>
      </div>

      {/* Weekly rent */}
      <NumberField
        label="Weekly rent (for comparison)"
        value={weeklyRent}
        onChange={setWeeklyRent}
        prefix="$"
        suffix="/wk"
        placeholder="e.g. 550"
      />

      {/* Finish & Bathrooms — stacked on mobile, side by side on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Finish / condition</label>
          <div className="flex flex-wrap gap-1.5">
            {FINISH_TIERS.map((t) => (
              <Pill key={t.value} selected={finishTier === t.value} onClick={() => setFinishTier(t.value)}>
                {t.label}
              </Pill>
            ))}
          </div>
          {finishTier && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {FINISH_TIERS.find(t => t.value === finishTier)?.desc}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Bathrooms</label>
          <div className="flex flex-wrap gap-1.5">
            {BATHROOM_OPTIONS.map((b) => (
              <Pill key={b} selected={bathrooms === b} onClick={() => setBathrooms(b)}>
                {b}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      {/* Furnishing (3-way) */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Furnishing</label>
        <div className="flex flex-wrap gap-1.5">
          <Pill selected={isFurnished === true && !isPartiallyFurnished} onClick={() => { setIsFurnished(true); setIsPartiallyFurnished(null); }}>
            Furnished
          </Pill>
          <Pill selected={!!isPartiallyFurnished} onClick={() => { setIsPartiallyFurnished(true); setIsFurnished(null); }}>
            Partial
          </Pill>
          <Pill selected={isFurnished === false && !isPartiallyFurnished} onClick={() => { setIsFurnished(false); setIsPartiallyFurnished(null); }}>
            Unfurnished
          </Pill>
        </div>
        {isFurnished === true && !isPartiallyFurnished && (
          <p className="text-xs text-muted-foreground mt-1 italic">Fully furnished with beds, couch, appliances, kitchenware</p>
        )}
        {!!isPartiallyFurnished && (
          <p className="text-xs text-muted-foreground mt-1 italic">Some furniture provided (e.g. whiteware only, or beds but no couch)</p>
        )}
        {isFurnished === false && !isPartiallyFurnished && (
          <p className="text-xs text-muted-foreground mt-1 italic">Empty — you bring everything</p>
        )}
      </div>

      {/* Property feature toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(dwellingType === 'Flat' || dwellingType === 'Apartment') && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Has parking</span>
            <div className="flex gap-1.5">
              {([true, false] as const).map((v) => (
                <Pill key={String(v)} selected={hasParking === v} onClick={() => setHasParking(v)}>
                  {v ? 'Yes' : 'No'}
                </Pill>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Has outdoor space</span>
          <div className="flex gap-1.5">
            {([true, false] as const).map((v) => (
              <Pill key={String(v)} selected={hasOutdoorSpace === v} onClick={() => setHasOutdoorSpace(v)}>
                {v ? 'Yes' : 'No'}
              </Pill>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Character / unique property</span>
          <div className="flex gap-1.5">
            {([true, false] as const).map((v) => (
              <Pill key={String(v)} selected={isCharacterProperty === v} onClick={() => setIsCharacterProperty(v)}>
                {v ? 'Yes' : 'No'}
              </Pill>
            ))}
          </div>
        </div>
        {(dwellingType === 'Room' || dwellingType === 'Flat') && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Shared kitchen</span>
            <div className="flex gap-1.5">
              {([true, false] as const).map((v) => (
                <Pill key={String(v)} selected={sharedKitchen === v} onClick={() => setSharedKitchen(v)}>
                  {v ? 'Yes' : 'No'}
                </Pill>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Utilities included</span>
          <div className="flex gap-1.5">
            {([true, false] as const).map((v) => (
              <Pill key={String(v)} selected={utilitiesIncluded === v} onClick={() => setUtilitiesIncluded(v)}>
                {v ? 'Yes' : 'No'}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      {/* Budget / affordability section */}
      {r && (
        <>
          <NumberField
            label="Annual income (for affordability)"
            value={r.annualIncome}
            onChange={(v) => updateRenter(addressId, { annualIncome: v })}
            prefix="$"
            placeholder="optional"
          />

          <button
            type="button"
            onClick={() => setShowBudget(!showBudget)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showBudget ? 'rotate-180' : ''}`} />
            {showBudget ? 'Hide' : 'Override'} monthly costs
          </button>
          {showBudget && (
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Monthly utilities"
                value={r.utilities}
                onChange={(v) => updateRenter(addressId, { utilities: v })}
                prefix="$"
                placeholder="auto"
              />
              <NumberField
                label="Contents insurance"
                value={r.contentsInsurance}
                onChange={(v) => updateRenter(addressId, { contentsInsurance: v })}
                prefix="$"
                placeholder="auto"
              />
              <NumberField
                label="Monthly transport"
                value={r.transport}
                onChange={(v) => updateRenter(addressId, { transport: v })}
                prefix="$"
                placeholder="auto"
              />
              <NumberField
                label="Monthly food"
                value={r.food}
                onChange={(v) => updateRenter(addressId, { food: v })}
                prefix="$"
                placeholder="auto"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Buyer Fields ───────────────────────────────────────── */
function BuyerFields({ addressId }: { addressId: number }) {
  const entry = useBudgetStore((s) => s.entries[addressId]);
  const updateBuyer = useBudgetStore((s) => s.updateBuyer);
  const b = entry?.buyer;
  const [showMore, setShowMore] = useState(false);

  const buyerBedrooms = useBuyerInputStore((s) => s.bedrooms);
  const buyerBathrooms = useBuyerInputStore((s) => s.bathrooms);
  const buyerFinishTier = useBuyerInputStore((s) => s.finishTier);
  const buyerAskingPrice = useBuyerInputStore((s) => s.askingPrice);
  const setBuyerBedrooms = useBuyerInputStore((s) => s.setBedrooms);
  const setBuyerBathrooms = useBuyerInputStore((s) => s.setBathrooms);
  const setBuyerFinishTier = useBuyerInputStore((s) => s.setFinishTier);
  const setBuyerAskingPrice = useBuyerInputStore((s) => s.setAskingPrice);

  if (!b) return null;

  return (
    <div className="space-y-3">
      {/* Bedrooms (required) */}
      <div className={!buyerBedrooms ? 'rounded-lg border-2 border-dashed border-piq-primary/40 p-2 -m-2 bg-piq-primary/5' : ''}>
        <label className="text-xs text-muted-foreground mb-1.5 block">Bedrooms <span className="text-risk-high">*</span></label>
        <div className="flex flex-wrap gap-1.5">
          {BEDROOM_OPTIONS.filter(br => br !== 'Studio').map((br) => (
            <Pill key={br} selected={buyerBedrooms === br} onClick={() => setBuyerBedrooms(br)}>
              {br}
            </Pill>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Bathrooms</label>
          <div className="flex flex-wrap gap-1.5">
            {BATHROOM_OPTIONS.map((ba) => (
              <Pill key={ba} selected={buyerBathrooms === ba} onClick={() => setBuyerBathrooms(ba)}>
                {ba}
              </Pill>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Finish / condition</label>
          <div className="flex flex-wrap gap-1.5">
            {FINISH_TIERS.map((t) => (
              <Pill key={t.value} selected={buyerFinishTier === t.value} onClick={() => setBuyerFinishTier(t.value)}>
                {t.label}
              </Pill>
            ))}
          </div>
          {buyerFinishTier && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {FINISH_TIERS.find(t => t.value === buyerFinishTier)?.desc}
            </p>
          )}
        </div>
      </div>

      {/* Asking price — syncs with purchase price */}
      <NumberField
        label="Asking / purchase price"
        value={buyerAskingPrice}
        onChange={(v) => { setBuyerAskingPrice(v); if (v) updateBuyer(addressId, { purchasePrice: v }); }}
        prefix="$"
        placeholder="e.g. 850000"
      />

      {/* Purchase details */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Purchase price"
          value={b.purchasePrice}
          onChange={(v) => { updateBuyer(addressId, { purchasePrice: v ?? 0 }); setBuyerAskingPrice(v); }}
          prefix="$"
        />
        <NumberField
          label="Deposit"
          value={b.depositPct}
          onChange={(v) => updateBuyer(addressId, { depositPct: v ?? 20 })}
          suffix="%"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Interest rate"
          value={b.interestRate}
          onChange={(v) => updateBuyer(addressId, { interestRate: v ?? 6.5 })}
          suffix="%"
        />
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Loan term</label>
          <div className="flex flex-wrap gap-1.5">
            {LOAN_TERMS.map((t) => (
              <Pill key={t} selected={b.loanTerm === t} onClick={() => updateBuyer(addressId, { loanTerm: t })}>
                {t}yr
              </Pill>
            ))}
          </div>
        </div>
      </div>

      <NumberField
        label="Annual income (for affordability)"
        value={b.annualIncome}
        onChange={(v) => updateBuyer(addressId, { annualIncome: v })}
        prefix="$"
        placeholder="optional"
      />

      {/* Collapsible overrides */}
      <button
        type="button"
        onClick={() => setShowMore(!showMore)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${showMore ? 'rotate-180' : ''}`} />
        {showMore ? 'Hide' : 'Override'} monthly costs
      </button>
      {showMore && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Monthly rates"
            value={b.rates}
            onChange={(v) => updateBuyer(addressId, { rates: v })}
            prefix="$"
            placeholder="auto"
          />
          <NumberField
            label="Monthly insurance"
            value={b.insurance}
            onChange={(v) => updateBuyer(addressId, { insurance: v })}
            prefix="$"
            placeholder="auto"
          />
          <NumberField
            label="Monthly utilities"
            value={b.utilities}
            onChange={(v) => updateBuyer(addressId, { utilities: v })}
            prefix="$"
            placeholder="auto"
          />
          <NumberField
            label="Monthly maintenance"
            value={b.maintenance}
            onChange={(v) => updateBuyer(addressId, { maintenance: v })}
            prefix="$"
            placeholder="auto"
          />
        </div>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */
export function ReportConfirmModal() {
  const { open, addressId, selectedTier, onConfirm, close, setSelectedTier } = useReportConfirmStore();
  const persona = usePersonaStore((s) => s.persona);
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();
  const credits = useDownloadGateStore((s) => s.credits);
  const isPro = credits?.plan === 'pro';
  const hasFullCredits = (credits?.fullCredits ?? 0) > 0 || isPro;
  const fullPrice = isPro ? '$4.99' : '$9.99';

  // Get address from cached report data
  const cachedReport = addressId
    ? queryClient.getQueryData<PropertyReport>(['property-report', addressId])
    : null;
  const addressName = cachedReport?.address?.full_address ?? '';

  // Check if minimum fields are filled
  const dwellingType = useRentInputStore((s) => s.dwellingType);
  const bedrooms = useRentInputStore((s) => s.bedrooms);
  const weeklyRent = useRentInputStore((s) => s.weeklyRent);
  const buyerEntry = useBudgetStore((s) => addressId ? s.entries[addressId] : undefined);

  const buyerBedrooms = useBuyerInputStore((s) => s.bedrooms);
  const renterReady = !!(dwellingType && bedrooms);
  const buyerReady = !!buyerBedrooms;
  const isReady = persona === 'renter' ? renterReady : buyerReady;

  const handleConfirm = () => {
    setGenerating(true);
    onConfirm?.(selectedTier);
    setTimeout(() => {
      close();
      setGenerating(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !generating) close(); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col scrollbar-none">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-piq-primary/10">
            <FileText className="h-6 w-6 text-piq-primary" />
          </div>
          <DialogTitle className="text-center text-lg">
            About this property
          </DialogTitle>
          {addressName && (
            <p className="text-center text-sm font-medium text-foreground truncate px-4">
              {addressName}
            </p>
          )}
          <DialogDescription className="text-center">
            {isReady
              ? 'The more accurate these details, the more tailored your report. Update anything that doesn\u2019t look right.'
              : 'Tell us about this property so we can tailor your report. Fill in the required fields (*) to get started.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Editable fields */}
        <div className="py-1">
          {persona === 'renter' ? (
            addressId && <RenterFields addressId={addressId} />
          ) : (
            addressId && <BuyerFields addressId={addressId} />
          )}
        </div>

        {!isReady && (
          <div className="rounded-lg border border-risk-high/30 bg-risk-high/5 p-2.5 text-xs text-center">
            <p className="font-semibold text-risk-high">
              {persona === 'renter'
                ? 'Select the property type and bedrooms to continue'
                : 'Select the number of bedrooms to continue'}
            </p>
            <p className="text-muted-foreground mt-0.5">We need these basics to tailor the analysis to this property</p>
          </div>
        )}

        {/* Tier selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSelectedTier('quick')}
            className={`rounded-lg border-2 p-3 text-left transition-all ${
              selectedTier === 'quick'
                ? 'border-piq-primary bg-piq-primary/5'
                : 'border-border hover:border-muted-foreground/40'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-piq-primary" />
              <span className="text-xs font-semibold">Quick Report</span>
            </div>
            <p className="text-xs text-muted-foreground">8 key sections, 30-day link</p>
            <p className="text-xs font-bold text-piq-success mt-1">Free</p>
          </button>
          <button
            type="button"
            onClick={() => setSelectedTier('full')}
            className={`rounded-lg border-2 p-3 text-left transition-all ${
              selectedTier === 'full'
                ? 'border-piq-primary bg-piq-primary/5'
                : 'border-border hover:border-muted-foreground/40'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-piq-primary" />
              <span className="text-xs font-semibold">Full Report</span>
            </div>
            <p className="text-xs text-muted-foreground">25+ sections, permanent link</p>
            <p className="text-xs font-bold mt-1">
              {hasFullCredits ? (
                <span className="text-piq-success">Use credit</span>
              ) : (
                <span className="text-piq-primary">{fullPrice}</span>
              )}
            </p>
          </button>
        </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-background border-t pt-3 flex gap-2 sm:flex-row">
          <button
            onClick={close}
            disabled={generating}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={generating || !isReady}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-piq-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-piq-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : selectedTier === 'quick' ? (
              'Generate Free Quick Report'
            ) : hasFullCredits ? (
              'Generate Full Report'
            ) : (
              `Get Full Report — ${fullPrice}`
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
