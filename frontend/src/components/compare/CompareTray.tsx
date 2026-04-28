'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { GitCompare, X, ArrowRight, Plus } from 'lucide-react';
import { useComparisonStore } from '@/stores/comparisonStore';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const COLUMN_LETTERS = ['A', 'B', 'C'] as const;
const COLUMN_ACCENTS = [
  'bg-piq-primary text-white',
  'bg-piq-accent-warm text-white',
  'bg-piq-primary-dark text-white',
];

export function CompareTray() {
  const items = useComparisonStore((s) => s.items);
  const remove = useComparisonStore((s) => s.remove);
  const router = useRouter();
  const pathname = usePathname();

  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Hide on scroll-down (mobile only). 10px threshold; reappear on any up.
  const lastScrollY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      if (delta > 10 && y > 80) setHidden(true);
      else if (delta < -4) setHidden(false);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Click-outside for desktop popover.
  const popoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!desktopOpen) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setDesktopOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [desktopOpen]);

  // Hide entirely when 0 staged, or when on the compare page itself.
  if (items.length === 0) return null;
  if (pathname?.startsWith('/compare')) return null;

  const canCompare = items.length >= 2;
  const goToCompare = () => {
    const ids = items.map((i) => i.addressId).join(',');
    router.push(`/compare?ids=${ids}`);
  };

  return (
    <>
      {/* ─── Desktop pill (fixed top-right) ─── */}
      <div
        ref={popoverRef}
        className="hidden md:block fixed top-3 right-4 z-50"
      >
        <button
          type="button"
          onClick={() => setDesktopOpen((o) => !o)}
          aria-expanded={desktopOpen}
          aria-label={`Comparison tray (${items.length} ${items.length === 1 ? 'property' : 'properties'})`}
          className="group flex items-center gap-2 h-9 px-4 rounded-full bg-piq-primary hover:bg-piq-primary-dark text-white text-sm font-medium shadow-md transition-colors"
        >
          <GitCompare className="size-4" />
          <span className="inline-flex items-center justify-center size-5 rounded-full bg-white text-piq-primary text-xs font-bold tabular-nums">
            {items.length}
          </span>
          <span>Compare</span>
        </button>

        {desktopOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-popover border rounded-lg shadow-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
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
                    onClick={() => remove(item.addressId)}
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
                  setDesktopOpen(false);
                  goToCompare();
                }}
                className={cn(
                  'w-full h-9 gap-2 font-medium',
                  canCompare
                    ? 'bg-piq-primary hover:bg-piq-primary-dark text-white'
                    : '',
                )}
              >
                Compare now
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Mobile bottom bar ─── */}
      <div
        className={cn(
          'md:hidden fixed bottom-2 left-2 right-2 z-50 transition-transform duration-200',
          hidden && 'translate-y-[calc(100%+0.5rem)]',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={`Open comparison tray (${items.length} of 2 properties)`}
          className="flex items-center justify-between w-full h-12 px-5 rounded-full bg-piq-primary hover:bg-piq-primary-dark text-white shadow-lg transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <GitCompare className="size-4" />
            <span className="inline-flex items-center justify-center size-5 rounded-full bg-white text-piq-primary text-xs font-bold tabular-nums">
              {items.length}
            </span>
            <span>{canCompare ? 'Compare 2' : 'Comparing'}</span>
          </span>
          <ArrowRight className="size-4" />
        </button>
      </div>

      {/* ─── Mobile expanded sheet ─── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[60vh]"
        >
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
                  onClick={() => remove(item.addressId)}
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
                setMobileOpen(false);
                goToCompare();
              }}
              className={cn(
                'w-full h-11 gap-2 font-medium',
                canCompare
                  ? 'bg-piq-primary hover:bg-piq-primary-dark text-white'
                  : '',
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
