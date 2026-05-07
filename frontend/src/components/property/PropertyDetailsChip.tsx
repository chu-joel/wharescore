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

import { useEffect, useState } from 'react';
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

// Module-scoped so all 3 PropertyReport breakpoint instances share one
// dedupe key. Set by whichever instance fires the POST first.
let lastAutoSaveKey: string | null = null;

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
  //
  // /property/[id]/page.tsx renders 3 PropertyReport instances (one per
  // breakpoint, all mounted but only one visible). The dedupe key lives
  // at module scope so all 3 chip instances see the same last-sent value
  // and only one POST fires per change.
  useEffect(() => {
    if (!bedrooms || !bathrooms) return;
    const key = `${addressId}|${persona}|${dwellingType ?? ''}|${bedrooms}|${bathrooms}|${finishTier ?? ''}`;
    if (lastAutoSaveKey === key) return;
    const timer = setTimeout(() => {
      if (lastAutoSaveKey === key) return;
      lastAutoSaveKey = key;
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
        if (lastAutoSaveKey === key) lastAutoSaveKey = null;
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [persona, addressId, dwellingType, bedrooms, bathrooms, finishTier]);

  // First-load default seeding. We seed dwellingType + finishTier from the
  // property's detected type and a sensible default ('modern'), so those
  // pills don't shout at the user. Bedrooms + bathrooms are intentionally
  // NOT seeded — they pulse red until the user picks them so the rent
  // comparison and Critical Renter rule fire on real user intent rather
  // than a guess. hydrateDefaults() only fills unset fields, so a user
  // returning from another property keeps their previous choices.
  useEffect(() => {
    const detected = (
      (report as unknown as { property_detection?: { detected_type?: string } })
        .property_detection?.detected_type ?? null
    ) as DwellingType | null;
    const sensibleDwelling: DwellingType | null =
      detected && DWELLING_TYPES.includes(detected) ? detected : null;
    hydrateDefaults({
      dwellingType: sensibleDwelling,
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
      <div className="flex justify-end -mb-1">
        <button
          type="button"
          onClick={() => setChipDismissed(false)}
          className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm hover:text-foreground hover:border-piq-primary/40 transition-colors"
          aria-label="Edit property details"
        >
          <Pencil className="h-3 w-3" />
          Edit details
        </button>
      </div>
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
      // Desktop: sticky inside the report column so it stays visible as the
      // user scrolls but never overlaps the PersonaToggle (which lives at
      // top-0 of the same scroll container). The flex wrapper pushes it to
      // the right edge of the column. Mobile/tablet: full-width inline
      // above PropertySummaryCard — every fixed bottom corner is already
      // booked by FloatingReportButton, ScrollPrompt, SignupNudge,
      // AnalyticsConsent.
      className="lg:sticky lg:top-14 lg:z-20 lg:flex lg:justify-end -mb-1"
    >
      <div
        className="w-full lg:w-[260px] lg:shadow-md rounded-xl border border-border bg-card/95 backdrop-blur-sm"
        data-testid="property-details-chip"
      >
      {/* Header row — tight. Title + dismiss × on the right. Title escalates
          to a soft red prompt while bedrooms or bathrooms is unset, so the
          user knows the chip wants something from them. */}
      <div className="flex items-center justify-between gap-2 px-2.5 pt-2 pb-1">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${
          (!bedrooms || !bathrooms)
            ? 'text-red-700 dark:text-red-300'
            : 'text-muted-foreground'
        }`}>
          {(!bedrooms || !bathrooms) ? 'Tell us about this place' : 'About this place'}
        </span>
        <button
          type="button"
          onClick={() => { closeAll(); setChipDismissed(true); }}
          className="text-muted-foreground/70 hover:text-foreground transition-colors -mr-1 -mt-0.5 p-0.5 rounded"
          aria-label="Dismiss property details"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Pills row — each value is a click-to-edit pill. Bold per the design.
          Bedrooms and bathrooms get an attention-grabbing red ring + pulse
          until the user picks a value, because the rent comparison +
          Critical-tier finding rule below need both to fire honestly.
          Dwelling and finish are seeded from defaults so they don't pulse. */}
      <div className="flex flex-wrap items-center gap-1 px-2.5 pb-1.5">
        <PillButton
          icon={<Bed className="h-2.5 w-2.5" />}
          label={bedsLabel}
          open={openField === 'beds'}
          attention={!bedrooms}
          onToggle={() => setOpenField(openField === 'beds' ? null : 'beds')}
        />
        <PillButton
          icon={<Bath className="h-2.5 w-2.5" />}
          label={bathsLabel}
          open={openField === 'baths'}
          attention={!bathrooms}
          onToggle={() => setOpenField(openField === 'baths' ? null : 'baths')}
        />
        <PillButton
          icon={<Building2 className="h-2.5 w-2.5" />}
          label={dwellingLabel}
          open={openField === 'dwelling'}
          attention={!dwellingType}
          onToggle={() => setOpenField(openField === 'dwelling' ? null : 'dwelling')}
        />
        <PillButton
          icon={<Sparkles className="h-2.5 w-2.5" />}
          label={finishLabel}
          open={openField === 'finish'}
          attention={!finishTier}
          onToggle={() => setOpenField(openField === 'finish' ? null : 'finish')}
        />
      </div>

      {/* Median caption — explains why these pills matter. Muted, single line. */}
      {median.median != null && (
        <div className="px-2.5 pb-2 text-[10.5px] leading-snug text-muted-foreground border-t border-border/40 pt-1.5">
          Median rent ({KIND_LABEL[median.kind] || 'this area'}): <span className="font-semibold text-foreground tabular-nums">${Math.round(median.median)}/wk</span>
          {median.thin && (
            <span className="ml-1 italic opacity-70">· thin data ({median.bonds} bonds)</span>
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
    </div>
  );
}

interface PillButtonProps {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  /** Highlight this pill (red ring + soft pulse) when the value is unset
   *  so the user feels it needs their attention. Resolves to a calm pill
   *  the moment a value is picked. */
  attention?: boolean;
  onToggle: () => void;
}
function PillButton({ icon, label, open, attention, onToggle }: PillButtonProps) {
  // Three visual states:
  //   open      — primary teal (this pill's dropdown is showing)
  //   attention — red ring + pulse + slightly hot background, drawing the
  //               eye until the user picks something
  //   default   — calm border, hover lifts to teal
  const stateClass = open
    ? 'border-piq-primary bg-piq-primary/10 text-piq-primary'
    : attention
      ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 ring-2 ring-red-500/30 ring-offset-1 ring-offset-card animate-pulse'
      : 'border-border bg-background text-foreground hover:border-piq-primary/50 hover:bg-piq-primary/5';
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums transition-colors min-h-[24px] ${stateClass}`}
      aria-expanded={open}
    >
      <span className={attention && !open ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground/70'}>{icon}</span>
      <span>{label}</span>
      <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180 text-piq-primary' : attention ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground/70'}`} />
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
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors min-h-[24px] ${
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
