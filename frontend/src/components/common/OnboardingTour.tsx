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
import { usePersonaStore } from '@/stores/personaStore';

const STORAGE_KEY = 'whare:onboarding_seen';

type StepAdvance = 'next-button' | 'address-selected' | 'persona-toggled' | 'auto-timer';

interface Step {
  id: string;
  target: string; // CSS selector, usually [data-tour="..."]
  title: string;
  body: string;
  advance: StepAdvance;
  placement?: 'below' | 'above' | 'left' | 'right' | 'auto';
  /** Additional behaviours to run on step entry. */
  onEnter?: 'scroll-report-down' | 'scroll-report-top';
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
    title: 'Click any property',
    body: "Tap a property on the map — any address works. We'll load the on-screen report once you do.",
    advance: 'address-selected',
    placement: 'auto',
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
    body: 'Flip between renter and buyer to retune the whole report — rent fairness and tenancy rights for renters, price advisor and due-diligence checklist for buyers.',
    advance: 'persona-toggled',
    placement: 'below',
    // Scroll back to the top first — persona toggle is sticky so it's
    // always visible, but aligning it with the viewport top makes the
    // spotlight look intentional.
    onEnter: 'scroll-report-top',
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
  const selectedAddress = useSearchStore((s) => s.selectedAddress);
  const clearSelection = useSearchStore((s) => s.clearSelection);
  const persona = usePersonaStore((s) => s.persona);
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

  // Auto-advance on address selection (step 3).
  useEffect(() => {
    if (!active) return;
    if (step.advance === 'address-selected' && selectedAddress) {
      // Wait for the report pane to render before advancing so the next
      // step's target (the PersonaToggle) exists.
      const t = setTimeout(() => goNext(), 800);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, selectedAddress]);

  // Run onEnter side-effects when a step activates. Kept in its own
  // effect so we don't re-trigger scrolling on every measurement.
  useEffect(() => {
    if (!active) return;
    if (step.onEnter === 'scroll-report-down') {
      // Multi-stage: wait a beat so the report has painted, scroll
      // ~420px to reveal KeyFindings / action card, pause, then scroll
      // back to the top so the persona step isn't disoriented. The
      // final scrollTop=0 runs slightly before this step's auto-timer
      // fires so the next step enters with the report re-aligned.
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
  onNext: () => void;
  onSkip: () => void;
}

function TourOverlay({ step, stepIndex, totalSteps, rect, onNext, onSkip }: OverlayProps) {
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
            "snappy but decelerating" feel.
          */}
          <div
            className="absolute left-0 right-0 top-0 bg-black/55 backdrop-blur-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ height: tr.top }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-black/55 backdrop-blur-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ top: tr.bottom }}
          />
          <div
            className="absolute bg-black/55 backdrop-blur-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ top: tr.top, height: tr.height, left: 0, width: tr.left }}
          />
          <div
            className="absolute bg-black/55 backdrop-blur-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ top: tr.top, height: tr.height, left: tr.right, right: 0 }}
          />
          {/* Ring around target — same transition so it tracks the
              cutout. Pulse on top of the transition for attention. */}
          <div
            className="absolute rounded-xl ring-2 ring-piq-primary ring-offset-2 ring-offset-background/50 animate-pulse transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ top: tr.top, left: tr.left, width: tr.width, height: tr.height }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />
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
            <span className="text-xs italic text-muted-foreground">Try it to continue…</span>
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
