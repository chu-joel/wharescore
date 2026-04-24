'use client';

import { HandCoins } from 'lucide-react';
import { usePersonaStore } from '@/stores/personaStore';

/**
 * Big CTA on the right of the risk score that jumps the user into the
 * rent analysis flow:
 *
 *   1. Smooth-scrolls to the "Is my rent fair?" accordion section
 *      (identified by data-tour-section="rent-fair").
 *   2. Programmatically opens the accordion if it's still collapsed by
 *      clicking its trigger button. The accordion is uncontrolled
 *      base-ui; simulating a click is the least invasive way to
 *      toggle it without refactoring the component to controlled mode.
 *   3. Dispatches a window CustomEvent "wharescore:highlight-rent-inputs"
 *      that RentComparisonFlow listens to and responds to by pulsing
 *      the Bedrooms + Weekly rent inputs for a few seconds. That makes
 *      the "you still need to fill these in" signal impossible to miss.
 *
 * Renter-only. Buyers don't see the rent section at all, so showing this
 * button to them would just confuse.
 */
export function EnterRentButton() {
  const persona = usePersonaStore((s) => s.persona);
  if (persona !== 'renter') return null;

  const handleClick = () => {
    const target = document.querySelector<HTMLElement>(
      '[data-tour-section="rent-fair"]'
    );
    if (!target) return;

    // Expand first (if collapsed). base-ui marks the content with
    // data-state="open|closed"; the trigger button is the first button
    // inside the accordion item.
    const trigger = target.querySelector<HTMLButtonElement>(
      'button[aria-expanded]'
    );
    const isOpen = trigger?.getAttribute('aria-expanded') === 'true';
    if (trigger && !isOpen) {
      trigger.click();
    }

    // Scroll into view. Block "start" so the section header sits near
    // the top of the viewport, not centred — centring tends to leave
    // the user with the trigger below the fold on mobile.
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Give the accordion a moment to finish animating open before we
    // tell RentComparisonFlow to pulse its inputs. Otherwise the
    // animation fires while the inputs are still off-screen / collapsed
    // and the user misses it.
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('wharescore:highlight-rent-inputs')
      );
    }, 450);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-xl bg-piq-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md ring-2 ring-piq-primary/20 transition-all hover:shadow-lg hover:ring-piq-primary/40 active:scale-[0.98]"
      aria-label="Jump to the rent analysis section"
    >
      <HandCoins className="h-4 w-4" />
      <span className="hidden sm:inline">Is my rent fair?</span>
      <span className="sm:hidden">My rent</span>
    </button>
  );
}
