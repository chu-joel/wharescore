'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { GitCompare, X, ArrowRight, Plus } from 'lucide-react';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useSearchStore } from '@/stores/searchStore';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const COLUMN_LETTERS = ['A', 'B', 'C'] as const;
const COLUMN_ACCENTS = [
  'bg-piq-primary text-white',
  'bg-piq-accent-warm text-white',
  'bg-piq-primary-dark text-white',
];

/**
 * Site-wide comparison tray.
 *
 * UX rationale (revised after the mobile bottom-bar collided with the
 * MobileDrawer's drag handle):
 *
 * - SAME POSITION on desktop AND mobile: a small floating pill anchored
 *   under the AppHeader at the top-right. Top-right is the universal
 *   "tray / actions / cart" zone in apps; mobile users tap there for
 *   menu items routinely. It NEVER collides with the bottom MobileDrawer,
 *   never overlaps the FeedbackFAB.
 * - DIFFERENT SIZING per breakpoint: desktop pill is wide ("⊟ 2 Compare"),
 *   mobile pill is icon-only with a count badge ("⊟ ②") so it doesn't
 *   crowd the narrow viewport. Same teal pill on both; same popover.
 * - PULSE on count change so a user who just added a property notices
 *   the count tick up even if they're focused on the report below.
 * - The popover (a compact dropdown) is reused for both breakpoints —
 *   one source of UI truth. On mobile it opens as a Sheet for easier
 *   thumb interaction with the larger remove buttons.
 */
export function CompareTray() {
  const items = useComparisonStore((s) => s.items);
  const remove = useComparisonStore((s) => s.remove);
  const selectedAddress = useSearchStore((s) => s.selectedAddress);
  const clearSelection = useSearchStore((s) => s.clearSelection);
  const router = useRouter();
  const pathname = usePathname();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  // Pulse animation triggers whenever the count changes — draws the eye
  // to the top-right pill after the user clicks "Compare" deeper in the
  // page. ~600ms pulse, then back to rest state.
  const lastCountRef = useRef(items.length);
  useEffect(() => {
    if (items.length !== lastCountRef.current) {
      lastCountRef.current = items.length;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 700);
      return () => clearTimeout(t);
    }
  }, [items.length]);

  // Click-outside for desktop popover.
  const popoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!popoverOpen) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [popoverOpen]);

  // Hide entirely when 0 staged, or when on the compare page itself.
  if (items.length === 0) return null;
  if (pathname?.startsWith('/compare')) return null;

  // Removing from the tray should also dismiss the property panel if the
  // user is currently viewing that property — otherwise the panel stays
  // open with a property they just removed.
  const removeAndDismiss = (addressId: number) => {
    if (selectedAddress?.addressId === addressId) {
      clearSelection();
    }
    remove(addressId);
  };

  const canCompare = items.length >= 2;
  const goToCompare = () => {
    const ids = items.map((i) => i.addressId).join(',');
    router.push(`/compare?ids=${ids}`);
  };

  const trayLabel = `Comparison tray — ${items.length} of 2 properties`;

  /* ── Trigger pill — icon-only at every breakpoint to keep it small and
       out of the way of in-page UI (e.g. the persona toggle in property
       reports). Tooltip on hover/focus carries the "Compare" affordance. */
  const triggerButton = (
    <button
      type="button"
      onClick={() => {
        // Desktop = popover. Mobile = sheet (better thumb hit area).
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setMobileSheetOpen(true);
        } else {
          setPopoverOpen((o) => !o);
        }
      }}
      aria-expanded={popoverOpen}
      aria-label={trayLabel}
      className={cn(
        'relative group inline-flex items-center justify-center rounded-full bg-piq-primary text-white shadow-md transition-all',
        'hover:bg-piq-primary-dark hover:shadow-lg active:scale-95',
        'size-9 sm:size-10',
        pulse && 'animate-in zoom-in-95 ring-4 ring-piq-primary/30',
      )}
    >
      <GitCompare className="size-4 sm:size-[18px]" />
      <span
        className={cn(
          'absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full',
          'bg-white text-piq-primary text-[11px] font-bold tabular-nums',
          'ring-2 ring-piq-primary',
          pulse && 'animate-in zoom-in-50 duration-300',
        )}
      >
        {items.length}
      </span>
    </button>
  );

  const triggerPill = (
    <div className="relative">
      <TooltipProvider delay={150}>
        <Tooltip>
          <TooltipTrigger render={triggerButton} />
          <TooltipContent side="left">
            {items.length === 1 ? 'Compare — 1 staged' : 'Compare — ready'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <>
      {/* Floating trigger anchored under the AppHeader. Same anchor on every
          breakpoint; the pill itself shrinks below md: above. */}
      <div
        ref={popoverRef}
        className="fixed top-[60px] right-3 sm:top-[68px] sm:right-4 z-[55]"
      >
        {triggerPill}

        {/* Desktop popover — anchored to the trigger. Hidden on mobile
            (mobile uses the Sheet below instead). */}
        {popoverOpen && (
          <div className="hidden md:block absolute right-0 mt-2 w-80 bg-popover border rounded-lg shadow-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-semibold">Comparing</h3>
              <span className="text-xs text-muted-foreground">{items.length}/2</span>
            </div>
            <div className="space-y-1">
              {items.map((item, idx) => (
                <div
                  key={item.addressId}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={cn(
                      'flex items-center justify-center size-8 rounded-md text-xs font-bold shrink-0',
                      COLUMN_ACCENTS[idx],
                    )}
                  >
                    {COLUMN_LETTERS[idx]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.fullAddress}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.suburb}
                      {item.city && item.suburb !== item.city ? `, ${item.city}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAndDismiss(item.addressId)}
                    aria-label={`Remove ${item.fullAddress}`}
                    className="shrink-0 p-1 rounded text-muted-foreground hover:text-piq-accent-hot hover:bg-muted transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              {items.length === 1 && (
                <div className="flex items-center gap-2 p-2 rounded-md border border-dashed border-border text-sm text-muted-foreground">
                  <Plus className="size-4" />
                  <span>Add another property to compare</span>
                </div>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <Button
                type="button"
                disabled={!canCompare}
                onClick={() => {
                  setPopoverOpen(false);
                  goToCompare();
                }}
                className={cn(
                  'w-full h-9 gap-2 font-medium',
                  canCompare ? 'bg-piq-primary hover:bg-piq-primary-dark text-white' : '',
                )}
              >
                Compare now
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile expanded sheet — opens from bottom. Better than a top
          popover on touch: gives larger remove buttons + comfortable
          thumb reach for the primary "Compare now" CTA. */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Comparing</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-2 space-y-2">
            {items.map((item, idx) => (
              <div
                key={item.addressId}
                className="flex items-center gap-3 p-3 rounded-lg border border-border"
              >
                <div
                  className={cn(
                    'flex items-center justify-center size-9 rounded-md text-sm font-bold shrink-0',
                    COLUMN_ACCENTS[idx],
                  )}
                >
                  {COLUMN_LETTERS[idx]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.fullAddress}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.suburb}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAndDismiss(item.addressId)}
                  aria-label={`Remove ${item.fullAddress}`}
                  className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-piq-accent-hot hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {items.length === 1 && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed text-sm text-muted-foreground">
                <Plus className="size-4" />
                <span>Add another property to compare</span>
              </div>
            )}
          </div>
          <div className="p-4 pt-2">
            <Button
              type="button"
              disabled={!canCompare}
              onClick={() => {
                setMobileSheetOpen(false);
                goToCompare();
              }}
              className={cn(
                'w-full h-11 gap-2 font-medium',
                canCompare ? 'bg-piq-primary hover:bg-piq-primary-dark text-white' : '',
              )}
            >
              Compare now
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
