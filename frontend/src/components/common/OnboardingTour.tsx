'use client';

/**
 * First-visit product tour. Walks a new user through:
 *   1. Map layer toggles (top chip bar / layer picker)
 *   2. Panning / zooming the map
 *   3. Clicking a property on the map (waits for selection)
 *   4. Switching between renter/buyer persona
 *   5. Generating a full report
 *
 * Implementation notes:
 *   - Targets are `data-tour="<id>"` attributes on existing components.
 *     This keeps the tour decoupled from internal layout changes — as
 *     long as the attribute exists somewhere, the step positions itself.
 *   - Uses pure DOM measurements (`getBoundingClientRect`) rather than
 *     refs so it works across portal boundaries (FloatingReportButton).
 *   - Persists `whare:onboarding_seen` in localStorage. Respects a
 *     `?tour=1` query param for forcing the tour (support / manual
 *     re-run).
 *   - Only starts when the user lands without a property selected
 *     (`?address=` absent). Coming in via a deep link skips the tour.
 *   - Steps 3 and 4 auto-advance on external signals (address selection,
 *     persona toggle) so the user doesn't have to click Next to
 *     acknowledge they did the thing.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import { useMapStore } from '@/stores/mapStore';
import { usePersonaStore } from '@/stores/personaStore';
import { apiFetch } from '@/lib/api';

const STORAGE_KEY = 'whare:onboarding_seen';

// Tour demo property. Wellington CBD address — good coverage across
// hazards, transit, census, rates, market data — and known to have
// flood extent, council hazard overlays and transmission-line
// proximity, so the report the user sees during the tour is populated
// rather than sparse. Fetched by address query so we don't hard-code
// an internal `address_id` that could drift.
const DEMO_ADDRESS_QUERY = '10 Customhouse Quay, Wellington';

type StepAdvance = 'next-button' | 'address-selected' | 'persona-toggled' | 'auto-timer';

interface Step {
  id: string;
  target: string; // CSS selector, usually [data-tour="..."]
  title: string;
  body: string;
  advance: StepAdvance;
  placement?: 'below' | 'above' | 'left' | 'right' | 'auto';
  /** Additional behaviours to run on step entry. */
  onEnter?:
    | 'scroll-report-down'
    | 'scroll-report-top'
    | 'auto-select-property'
    | 'auto-toggle-persona';
  /** Milliseconds before auto-advancing. Used when advance='auto-timer'. */
  autoMs?: number;
}

const STEPS: Step[] = [
  {
    id: 'layers',
    target: '[data-tour="map-layers"]',
    title: 'Toggle map layers',
    body: 'Turn hazard, transport, zoning and amenity overlays on or off. Mix layers to compare what matters most to you.',
    advance: 'next-button',
    placement: 'below',
  },
  {
    id: 'map',
    target: '[data-tour="map"]',
    title: 'Explore the map',
    body: 'Drag to pan, scroll or pinch to zoom. Active layers repaint as you move so you can scan whole suburbs quickly.',
    advance: 'next-button',
    placement: 'auto',
  },
  {
    id: 'click-property',
    target: '[data-tour="map"]',
    title: 'Loading a sample property',
    body: "We'll drop you on a Wellington CBD address with real hazard, rent and planning data loaded, so you can see what a full report looks like.",
    advance: 'address-selected',
    placement: 'auto',
    onEnter: 'auto-select-property',
  },
  {
    id: 'scroll',
    // Spotlight on the whole report panel. Uses `main` as a close-enough
    // anchor that exists on all breakpoints.
    target: 'body',
    title: 'Scroll to explore the report',
    body: 'Score → key findings → recommended actions → deep-dive accordion. We\'ll scroll through for you so you can see what\'s in there.',
    advance: 'auto-timer',
    autoMs: 3200,
    placement: 'auto',
    onEnter: 'scroll-report-down',
  },
  {
    id: 'persona',
    target: '[data-tour="persona-toggle"]',
    title: 'Renter or buyer?',
    body: 'Flipping personas retunes the whole report — rent fairness and tenancy rights for renters, price advisor and due-diligence checklist for buyers.',
    advance: 'persona-toggled',
    placement: 'below',
    // Auto-click the OTHER persona tab with a visible tap ripple so
    // the user sees the report recompute without having to do it
    // themselves. Scroll is handled by the shared step-enter block.
    onEnter: 'auto-toggle-persona',
  },
  {
    id: 'generate',
    target: '[data-tour="generate-report"]',
    title: 'Get the full report',
    body: 'Generate the hosted interactive report for deep analysis — rent/price advisor with adjustable inputs, 25+ sections, permanent shareable link.',
    advance: 'next-button',
    placement: 'above',
  },
];

function readRect(selector: string): DOMRect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

/** Find the scroll container that holds the PropertyReport. Uses the
 * PersonaToggle as an anchor (it lives inside the report) and walks up
 * looking for the nearest vertically-scrollable ancestor. Works across
 * desktop (SplitView pane), tablet (TabletPanel), and mobile (the
 * MobileDrawer's contentRef). Returns null when no report is mounted. */
function findReportScrollContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const anchor = document.querySelector('[data-tour="persona-toggle"]') as HTMLElement | null;
  if (!anchor) return null;
  let el: HTMLElement | null = anchor.parentElement;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  // Mobile path: the MobileDrawer's internal scroll container may not
  // have overflow-y set declaratively at all breakpoints. Fall back to
  // the document scrolling element.
  return document.scrollingElement as HTMLElement | null;
}

function scrollReportSmooth(targetTop: number) {
  const container = findReportScrollContainer();
  if (!container) return;
  container.scrollTo({ top: targetTop, behavior: 'smooth' });
}

export function OnboardingTour() {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Click/tap ripple — rendered over the target centre when the tour
  // auto-clicks something. Keyed by timestamp so remount re-triggers
  // the CSS animation even if two consecutive steps both want a
  // ripple at roughly the same coordinates.
  const [tap, setTap] = useState<{ x: number; y: number; key: number } | null>(null);
  const selectedAddress = useSearchStore((s) => s.selectedAddress);
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const clearSelection = useSearchStore((s) => s.clearSelection);
  const selectProperty = useMapStore((s) => s.selectProperty);
  const persona = usePersonaStore((s) => s.persona);
  const setPersona = usePersonaStore((s) => s.setPersona);
  const initialPersonaRef = useRef<string | null>(null);

  // Decide whether to run at all. Only on first visit (or explicit
  // ?tour=1) AND only when the user lands without a property already
  // selected — coming in on a shared link is deeper-funnel.
  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const force = params.get('tour') === '1';
    const seen = window.localStorage.getItem(STORAGE_KEY) === '1';
    const onProperty = params.has('address');
    if (force || (!seen && !onProperty)) {
      // Small delay so the page has painted and target elements have
      // mounted. Without this the first step measures nothing.
      const t = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Listen for manual re-run requests (Help menu → Take the tour).
  // Resets the seen flag, sends the user back to the map + landing
  // panel, and enters step 0.
  useEffect(() => {
    const handler = () => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      clearSelection();
      setStepIdx(0);
      initialPersonaRef.current = null;
      // Give the page a beat to unmount any open report before we
      // start measuring the step-0 target.
      setTimeout(() => setActive(true), 300);
    };
    window.addEventListener('tour:restart', handler);
    return () => window.removeEventListener('tour:restart', handler);
  }, [clearSelection]);

  const step = STEPS[stepIdx];

  // Position tracking — re-measure on step change, resize, and a short
  // interval (targets can shift as their host components render).
  useEffect(() => {
    if (!active) return;
    const measure = () => setRect(readRect(step.target));
    measure();
    const rAF = requestAnimationFrame(measure);
    const interval = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(rAF);
      clearInterval(interval);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, step]);

  // Auto-advance on address selection (step 3). Don't rely on a fixed
  // timeout — the PropertyReport fetch is async and can take several
  // seconds (SQL + transit + terrain overlays). If we advance too
  // early the next step tries to measure/tap a PersonaToggle that
  // isn't in the DOM yet and the tap ripple lands on empty space.
  //
  // Strategy: poll for `[data-tour="persona-toggle"]` — it renders
  // inside PropertyReport, which only mounts after the fetch resolves.
  // Once the toggle exists AND its rect is non-zero (i.e. it's
  // actually laid out, not just in the DOM), advance with a short
  // grace delay so the user sees the loaded report for a beat.
  useEffect(() => {
    if (!active) return;
    if (step.advance !== 'address-selected') return;
    if (!selectedAddress) return;

    let tries = 0;
    const MAX_TRIES = 60; // 60 × 200ms = 12s — generous for slow connections
    const interval = setInterval(() => {
      const el = document.querySelector('[data-tour="persona-toggle"]') as HTMLElement | null;
      const rect = el?.getBoundingClientRect();
      const ready = !!(rect && rect.width > 0 && rect.height > 0);
      if (ready || tries >= MAX_TRIES) {
        clearInterval(interval);
        // Grace period so the loaded report is visible for a moment
        // before the tour moves on.
        setTimeout(() => goNext(), 700);
      }
      tries++;
    }, 200);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, selectedAddress]);

  // Helper — show a tap ripple at the centre of the current target so
  // the user sees WHERE the tour is clicking, not just the effect.
  const pulseAtTarget = () => {
    const r = readRect(step.target);
    if (!r) return;
    setTap({ x: r.left + r.width / 2, y: r.top + r.height / 2, key: Date.now() });
  };

  // Run onEnter side-effects when a step activates. Kept in its own
  // effect so we don't re-trigger behaviours on every measurement.
  useEffect(() => {
    if (!active) return;
    if (step.onEnter === 'scroll-report-down') {
      // Wait a beat so the report has painted, scroll ~420px to
      // reveal KeyFindings / action card, pause, then scroll back to
      // the top so the persona step isn't disoriented. The final
      // scrollTop=0 runs slightly before this step's auto-timer so
      // the next step enters with the report re-aligned.
      const down = setTimeout(() => scrollReportSmooth(420), 400);
      const up = setTimeout(() => scrollReportSmooth(0), 2800);
      return () => {
        clearTimeout(down);
        clearTimeout(up);
      };
    }
    if (step.onEnter === 'scroll-report-top') {
      scrollReportSmooth(0);
    }
    if (step.onEnter === 'auto-select-property') {
      // Tap ripple on the map, then fetch + select the demo address.
      // Wrapped in setTimeout so the ripple is visible before the
      // report pane mounts and shifts everything.
      const tapT = setTimeout(() => pulseAtTarget(), 500);
      const pickT = setTimeout(() => {
        apiFetch<{
          results?: { address_id: number; full_address: string; lng: number; lat: number }[];
        }>(`/api/v1/search/address?q=${encodeURIComponent(DEMO_ADDRESS_QUERY)}`)
          .then((res) => {
            const first = res.results?.[0];
            if (!first) return;
            selectAddress({
              addressId: first.address_id,
              fullAddress: first.full_address,
              lng: first.lng,
              lat: first.lat,
            });
            selectProperty(first.address_id, first.lng, first.lat);
          })
          .catch(() => {
            // Non-critical — if the demo picker fails we let the user
            // click manually. The advance='address-selected' wiring
            // still catches any selection they make.
          });
      }, 900);
      return () => {
        clearTimeout(tapT);
        clearTimeout(pickT);
      };
    }
    if (step.onEnter === 'auto-toggle-persona') {
      // Scroll the toggle into view, then wait for it to be
      // measurable before firing the tap + toggle. Step 3's
      // address-selected poll already waited for the toggle to
      // appear, but the scroll + sticky repositioning can still
      // produce a 0-height rect for a frame or two. Polling here is
      // belt-and-braces so the ripple lands on the real element.
      scrollReportSmooth(0);
      let settled = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const startWhenReady = () => {
        if (settled) return;
        const r = readRect(step.target);
        if (r && r.width > 0 && r.height > 0) {
          settled = true;
          // Tap ripple first, then toggle after the ripple peaks so
          // the cause/effect is visible.
          timers.push(setTimeout(() => pulseAtTarget(), 300));
          timers.push(setTimeout(() => {
            setPersona(persona === 'renter' ? 'buyer' : 'renter');
          }, 700));
        } else {
          timers.push(setTimeout(startWhenReady, 150));
        }
      };
      timers.push(setTimeout(startWhenReady, 350));
      return () => {
        settled = true;
        timers.forEach(clearTimeout);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step]);

  // Auto-advance for timer-based steps (e.g. the scroll demo). Kept
  // separate from the onEnter effect above so the two can be reasoned
  // about independently.
  useEffect(() => {
    if (!active) return;
    if (step.advance !== 'auto-timer') return;
    const ms = step.autoMs ?? 3000;
    const t = setTimeout(() => goNext(), ms);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step]);

  // Auto-advance on persona toggle (step 4). Snapshot the initial
  // persona on step entry so we only advance when it changes, not if
  // the user already had it set.
  useEffect(() => {
    if (!active) return;
    if (step.advance === 'persona-toggled') {
      if (initialPersonaRef.current === null) {
        initialPersonaRef.current = persona;
        return;
      }
      if (persona !== initialPersonaRef.current) {
        const t = setTimeout(() => goNext(), 400);
        return () => clearTimeout(t);
      }
    } else {
      initialPersonaRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, persona]);

  const finish = () => {
    setActive(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    // Hand the user back to an empty map + landing panel so they can
    // explore from scratch, rather than leaving them parked in the
    // demo report they just walked through.
    clearSelection();
  };

  const goNext = () => {
    if (stepIdx >= STEPS.length - 1) {
      finish();
      return;
    }
    setStepIdx((i) => i + 1);
  };

  if (!mounted || !active) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <TourOverlay
      step={step}
      stepIndex={stepIdx}
      totalSteps={STEPS.length}
      rect={rect}
      tap={tap}
      onNext={goNext}
      onSkip={finish}
    />,
    document.body,
  );
}

interface OverlayProps {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  rect: DOMRect | null;
  tap: { x: number; y: number; key: number } | null;
  onNext: () => void;
  onSkip: () => void;
}

function TourOverlay({ step, stepIndex, totalSteps, rect, tap, onNext, onSkip }: OverlayProps) {
  // Spotlight: a solid rgba overlay with a transparent cutout around
  // the target. Implemented as 4 dim rectangles (top, bottom, left,
  // right of the target) rather than an SVG mask — simpler, pixel
  // perfect, and clickable-through via pointer-events: none.
  const pad = 8;
  const haveTarget = rect && rect.width > 0 && rect.height > 0;
  const tr = haveTarget
    ? {
        top: Math.max(0, rect!.top - pad),
        left: Math.max(0, rect!.left - pad),
        right: rect!.right + pad,
        bottom: rect!.bottom + pad,
        width: rect!.width + pad * 2,
        height: rect!.height + pad * 2,
      }
    : null;

  // Tooltip placement — try user-preferred side, fall back to whatever
  // fits without overflowing the viewport. Tooltip is ~320px wide.
  const tooltip = computeTooltipPos(step.placement ?? 'auto', tr);

  const canAdvanceManually = step.advance === 'next-button';

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none">
      {/* Dim layers — 4 rectangles around the target cutout, or full
          overlay if the target couldn't be measured. Clicks pass
          through so the user can still interact with the target
          (crucial for steps 3 "click a property" and the spotlight
          around chip rows). */}
      {tr ? (
        <>
          {/*
            All four dim rectangles share the same transition so the
            cutout slides smoothly from one target to the next rather
            than jumping. cubic-bezier(0.32, 0.72, 0, 1) is the same
            iOS-ish easing used by the MobileDrawer, for a consistent
            "snappy but decelerating" feel. pointer-events-auto +
            onClick={onSkip} makes clicks on the dim area dismiss the
            tour (the tooltip still captures its own clicks via
            stopPropagation, and the target spotlight region has no
            dim over it).
          */}
          <div
            className="absolute left-0 right-0 top-0 bg-black/55 backdrop-blur-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-auto cursor-pointer"
            style={{ height: tr.top }}
            onClick={onSkip}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-black/55 backdrop-blur-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-auto cursor-pointer"
            style={{ top: tr.bottom }}
            onClick={onSkip}
          />
          <div
            className="absolute bg-black/55 backdrop-blur-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-auto cursor-pointer"
            style={{ top: tr.top, height: tr.height, left: 0, width: tr.left }}
            onClick={onSkip}
          />
          <div
            className="absolute bg-black/55 backdrop-blur-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-auto cursor-pointer"
            style={{ top: tr.top, height: tr.height, left: tr.right, right: 0 }}
            onClick={onSkip}
          />
          {/* Ring around target — same transition so it tracks the
              cutout. Pulse on top of the transition for attention. */}
          <div
            className="absolute rounded-xl ring-2 ring-piq-primary ring-offset-2 ring-offset-background/50 animate-pulse transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-none"
            style={{ top: tr.top, left: tr.left, width: tr.width, height: tr.height }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 bg-black/55 backdrop-blur-[1px] pointer-events-auto cursor-pointer"
          onClick={onSkip}
        />
      )}

      {/* Tap ripple — a small pulse at the target centre when the tour
          auto-clicks something, so the user sees where the action
          happened. Remount-on-key re-triggers the CSS animation. */}
      {tap && (
        <div
          key={tap.key}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-piq-primary/40 animate-ping"
          style={{ left: tap.x, top: tap.y, animationDuration: '700ms', animationIterationCount: 2 }}
        />
      )}

      {/* Tooltip — same cubic-bezier so position, fade and the spotlight
          all move together. Fades in on mount via the `opacity` class
          below combined with the initial render. */}
      <div
        role="dialog"
        aria-label={step.title}
        className="absolute pointer-events-auto rounded-xl bg-background border border-border shadow-xl p-4 max-w-[320px] w-[calc(100vw-32px)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] animate-fade-in-up"
        style={{ top: tooltip.top, left: tooltip.left }}
        key={step.id}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs font-medium text-muted-foreground">
            Step {stepIndex + 1} of {totalSteps}
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="text-sm font-bold mb-1">{step.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>
          {canAdvanceManually ? (
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1 rounded-lg bg-piq-primary text-white px-3 py-1.5 text-xs font-semibold hover:bg-piq-primary-dark transition-colors"
            >
              {stepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            // For auto-advance steps the tour performs the action itself
            // (seeding a property, toggling persona, scrolling). No
            // "Try it" text — we don't want the user thinking they
            // need to do something. Leaving the space empty keeps the
            // focus on the content.
            <span className="text-xs text-muted-foreground">Auto-advancing…</span>
          )}
        </div>
      </div>
    </div>
  );
}

function computeTooltipPos(
  preferred: 'below' | 'above' | 'left' | 'right' | 'auto',
  tr: { top: number; left: number; right: number; bottom: number; width: number; height: number } | null,
): { top: number; left: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const tipW = Math.min(320, vw - 32);
  const tipH = 180; // rough height; tooltip is small and the dialog doesn't need perfect fit
  const gap = 12;
  const margin = 16;

  if (!tr) {
    return { top: (vh - tipH) / 2, left: (vw - tipW) / 2 };
  }

  const options: Record<'below' | 'above' | 'left' | 'right', { top: number; left: number; fits: boolean }> = {
    below: {
      top: tr.bottom + gap,
      left: Math.min(Math.max(tr.left, margin), vw - tipW - margin),
      fits: tr.bottom + gap + tipH < vh - margin,
    },
    above: {
      top: tr.top - tipH - gap,
      left: Math.min(Math.max(tr.left, margin), vw - tipW - margin),
      fits: tr.top - tipH - gap > margin,
    },
    right: {
      top: Math.min(Math.max(tr.top, margin), vh - tipH - margin),
      left: tr.right + gap,
      fits: tr.right + gap + tipW < vw - margin,
    },
    left: {
      top: Math.min(Math.max(tr.top, margin), vh - tipH - margin),
      left: tr.left - tipW - gap,
      fits: tr.left - tipW - gap > margin,
    },
  };

  const order: ('below' | 'above' | 'left' | 'right')[] =
    preferred === 'auto'
      ? ['below', 'above', 'right', 'left']
      : preferred === 'below'
        ? ['below', 'above', 'right', 'left']
        : preferred === 'above'
          ? ['above', 'below', 'right', 'left']
          : preferred === 'right'
            ? ['right', 'left', 'below', 'above']
            : ['left', 'right', 'below', 'above'];

  for (const side of order) {
    if (options[side].fits) {
      return { top: options[side].top, left: options[side].left };
    }
  }
  // Nothing fits — centre.
  return { top: (vh - tipH) / 2, left: (vw - tipW) / 2 };
}
