'use client';

// Compact "About this place" chip. Drives bedrooms/bathrooms/dwelling/finish
// for the rent and price comparisons across the report. Sticky top-right on
// desktop (off to the side, never blocks reading), inline-and-scroll on
// mobile (no fixed positioning, every bottom corner is already taken by
// FloatingReportButton, ScrollPrompt, SignupNudge and AnalyticsConsent).
//
// Dismissible via × — when dismissed a tiny "Edit details" pill appears in
// place so the affordance never disappears entirely. Dismissal isn't
// persisted; users see the full chip again on a fresh session.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X, Pencil, Bed, Bath, Building2, Sparkles } from 'lucide-react';
import {
  usePropertyDetailsStore,
  DWELLING_TYPES,
  BEDROOM_VALUES,
  BATHROOM_VALUES,
  FINISH_TIERS,
  type DwellingType,
  type Bedrooms,
  type Bathrooms,
  type FinishTier,
} from '@/stores/propertyDetailsStore';
import {
  useTypologyMedian,
  defaultBedroomsForSA2,
  type MedianMatchKind,
} from '@/hooks/useTypologyMedian';
import { usePersonaStore } from '@/stores/personaStore';
import { apiFetch } from '@/lib/api';
import type { PropertyReport } from '@/lib/types';

interface PropertyDetailsChipProps {
  report: PropertyReport;
}

function getRentalOverview(report: PropertyReport) {
  return report.market?.rental_overview ?? [];
}

const FINISH_LABELS: Record<FinishTier, string> = {
  basic: 'Basic',
  standard: 'Standard',
  modern: 'Modern',
  premium: 'Premium',
  luxury: 'Luxury',
};

const KIND_LABEL: Record<MedianMatchKind, string> = {
  exact: 'this typology',
  dwelling: `same dwelling type`,
  beds: 'same bedroom count',
  sa2: 'all rentals in the SA2',
  none: '',
};

export function PropertyDetailsChip({ report }: PropertyDetailsChipProps) {
  const dwellingType = usePropertyDetailsStore((s) => s.dwellingType);
  const bedrooms = usePropertyDetailsStore((s) => s.bedrooms);
  const bathrooms = usePropertyDetailsStore((s) => s.bathrooms);
  const finishTier = usePropertyDetailsStore((s) => s.finishTier);
  const setDwellingType = usePropertyDetailsStore((s) => s.setDwellingType);
  const setBedrooms = usePropertyDetailsStore((s) => s.setBedrooms);
  const setBathrooms = usePropertyDetailsStore((s) => s.setBathrooms);
  const setFinishTier = usePropertyDetailsStore((s) => s.setFinishTier);
  const chipDismissed = usePropertyDetailsStore((s) => s.chipDismissed);
  const setChipDismissed = usePropertyDetailsStore((s) => s.setChipDismissed);
  const hydrateDefaults = usePropertyDetailsStore((s) => s.hydrateDefaults);
  const [openField, setOpenField] = useState<null | 'dwelling' | 'beds' | 'baths' | 'finish'>(null);

  const persona = usePersonaStore((s) => s.persona);
  const addressId = report.address.address_id;
  const rentalOverview = getRentalOverview(report);
  const median = useTypologyMedian(rentalOverview as Parameters<typeof useTypologyMedian>[0]);

  // Auto-save when both bedrooms AND bathrooms are set. Posts the chosen
  // descriptors to the existing /budget-inputs upsert endpoint (which
  // handles both renter and buyer personas). Debounced 800ms after the
  // last edit so picking through the dropdowns doesn't fire one POST per
  // click. The endpoint upserts within a 24h window so subsequent
  // PriceAdvisorCard / RentComparisonFlow / BuyerBudgetCalculator submits
  // enrich the same row via COALESCE rather than overwriting.
  const lastSaveKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!bedrooms || !bathrooms) return;
    const key = `${persona}|${dwellingType ?? ''}|${bedrooms}|${bathrooms}|${finishTier ?? ''}`;
    if (lastSaveKeyRef.current === key) return;
    const timer = setTimeout(() => {
      lastSaveKeyRef.current = key;
      apiFetch('/api/v1/budget-inputs', {
        method: 'POST',
        body: JSON.stringify({
          address_id: addressId,
          persona,
          bedrooms,
          bathrooms,
          finish_tier: finishTier,
          source_context: 'property_details_chip',
          notice_version:
            typeof window !== 'undefined' &&
            window.localStorage?.getItem('analytics_consent') === 'true'
              ? 'combined_v1'
              : null,
        }),
      }).catch(() => {
        // Non-fatal — let the next edit retry.
        lastSaveKeyRef.current = null;
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [persona, addressId, dwellingType, bedrooms, bathrooms, finishTier]);

  // First-load default seeding from the property report. The store keeps
  // user choices (so a fresh address inherits the previous typology), but
  // when nothing has been chosen yet we lean on the property's detected
  // type and the most-bonded bedroom count for that dwelling in this SA2.
  useEffect(() => {
    const detected = (
      (report as unknown as { property_detection?: { detected_type?: string } })
        .property_detection?.detected_type ?? null
    ) as DwellingType | null;
    const sensibleDwelling: DwellingType | null =
      detected && DWELLING_TYPES.includes(detected) ? detected : null;
    const sensibleBeds = defaultBedroomsForSA2(
      rentalOverview as Parameters<typeof defaultBedroomsForSA2>[0],
      sensibleDwelling,
    );
    hydrateDefaults({
      dwellingType: sensibleDwelling,
      bedrooms: sensibleBeds,
      bathrooms: '1',
      finishTier: 'modern',
    });
    // Intentionally only seed on initial mount — re-running on store
    // updates would clobber user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closing one dropdown opens nothing. Click-outside is wired up via a
  // backdrop layer below.
  if (chipDismissed) {
    return (
      <button
        type="button"
        onClick={() => setChipDismissed(false)}
        className="lg:fixed lg:top-20 lg:right-4 lg:z-30 inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground hover:border-piq-primary/40 transition-colors"
        aria-label="Edit property details"
      >
        <Pencil className="h-3 w-3" />
        Edit details
      </button>
    );
  }

  const showLabel = (val: string | null, fallback: string) => val ?? fallback;
  const bedsLabel = bedrooms ? `${bedrooms} bed` : '— bed';
  const bathsLabel = bathrooms ? `${bathrooms} bath` : '— bath';
  const dwellingLabel = showLabel(dwellingType, 'Pick type');
  const finishLabel = finishTier ? FINISH_LABELS[finishTier] : 'Pick finish';

  const closeAll = () => setOpenField(null);

  return (
    <div
      className="lg:fixed lg:top-20 lg:right-4 lg:z-30 lg:w-[280px] w-full max-w-md mx-auto rounded-xl border border-border bg-card shadow-sm"
      data-testid="property-details-chip"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          About this place
        </span>
        <button
          type="button"
          onClick={() => { closeAll(); setChipDismissed(true); }}
          className="text-muted-foreground hover:text-foreground transition-colors -mr-1 p-1"
          aria-label="Dismiss property details"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Pills row — each value is a click-to-edit pill. Bold per the design. */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <PillButton
          icon={<Bed className="h-3 w-3" />}
          label={bedsLabel}
          open={openField === 'beds'}
          onToggle={() => setOpenField(openField === 'beds' ? null : 'beds')}
        />
        <PillButton
          icon={<Bath className="h-3 w-3" />}
          label={bathsLabel}
          open={openField === 'baths'}
          onToggle={() => setOpenField(openField === 'baths' ? null : 'baths')}
        />
        <PillButton
          icon={<Building2 className="h-3 w-3" />}
          label={dwellingLabel}
          open={openField === 'dwelling'}
          onToggle={() => setOpenField(openField === 'dwelling' ? null : 'dwelling')}
        />
        <PillButton
          icon={<Sparkles className="h-3 w-3" />}
          label={finishLabel}
          open={openField === 'finish'}
          onToggle={() => setOpenField(openField === 'finish' ? null : 'finish')}
        />
      </div>

      {/* Median caption — explains why these pills matter. Muted, single line. */}
      {median.median != null && (
        <div className="px-3 pb-2 text-[11px] leading-snug text-muted-foreground">
          Median rent for {KIND_LABEL[median.kind] || 'this area'}: <span className="font-semibold text-foreground tabular-nums">${Math.round(median.median)}/wk</span>
          {median.thin && (
            <span className="ml-1 italic">(thin data, {median.bonds} bonds)</span>
          )}
        </div>
      )}

      {/* Active dropdown — single popover under the pill row. Click-outside
          backdrop closes it. */}
      {openField && (
        <>
          <div
            className="fixed inset-0 z-30 lg:z-20"
            onClick={closeAll}
            aria-hidden
          />
          <div className="relative z-40 border-t border-border/60 bg-muted/30 px-3 py-2">
            {openField === 'beds' && (
              <Choices
                values={BEDROOM_VALUES}
                current={bedrooms}
                onPick={(v) => { setBedrooms(v as Bedrooms); closeAll(); }}
                fmt={(v) => `${v} bed`}
              />
            )}
            {openField === 'baths' && (
              <Choices
                values={BATHROOM_VALUES}
                current={bathrooms}
                onPick={(v) => { setBathrooms(v as Bathrooms); closeAll(); }}
                fmt={(v) => `${v} bath`}
              />
            )}
            {openField === 'dwelling' && (
              <Choices
                values={DWELLING_TYPES}
                current={dwellingType}
                onPick={(v) => { setDwellingType(v as DwellingType); closeAll(); }}
                fmt={(v) => v}
              />
            )}
            {openField === 'finish' && (
              <Choices
                values={FINISH_TIERS}
                current={finishTier}
                onPick={(v) => { setFinishTier(v as FinishTier); closeAll(); }}
                fmt={(v) => FINISH_LABELS[v as FinishTier]}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface PillButtonProps {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
}
function PillButton({ icon, label, open, onToggle }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums transition-colors ${
        open
          ? 'border-piq-primary bg-piq-primary/10 text-piq-primary'
          : 'border-border bg-background text-foreground hover:border-piq-primary/50 hover:bg-piq-primary/5'
      }`}
      aria-expanded={open}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

interface ChoicesProps<T extends string> {
  values: readonly T[];
  current: T | null;
  onPick: (v: T) => void;
  fmt: (v: T) => string;
}
function Choices<T extends string>({ values, current, onPick, fmt }: ChoicesProps<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            current === v
              ? 'border-piq-primary bg-piq-primary/10 text-piq-primary font-semibold'
              : 'border-border bg-background hover:bg-muted/40'
          }`}
        >
          {fmt(v)}
        </button>
      ))}
    </div>
  );
}
