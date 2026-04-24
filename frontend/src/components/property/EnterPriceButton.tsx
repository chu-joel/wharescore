'use client';

import { Calculator } from 'lucide-react';
import { usePersonaStore } from '@/stores/personaStore';

/**
 * Buyer mirror of EnterRentButton. Lives on the right of the risk
 * score and jumps the user into the price advisor flow:
 *
 *   1. Smooth-scrolls to the "What will it really cost?" accordion
 *      (data-tour-section="true-cost") which contains PriceAdvisorCard.
 *   2. Programmatically opens the accordion if it's still collapsed by
 *      simulating a click on the trigger button. Same pattern as
 *      EnterRentButton — base-ui Accordion is uncontrolled and a click
 *      is the least invasive way to toggle without refactoring it.
 *   3. Dispatches a window CustomEvent "wharescore:highlight-price-inputs"
 *      that PriceAdvisorCard listens to and responds to by pulsing the
 *      Asking price + Bedrooms inputs for a few seconds. Makes the
 *      "you still need to fill these in" signal impossible to miss.
 *
 * Buyer-only. Renters get EnterRentButton instead.
 */
export function EnterPriceButton() {
  const persona = usePersonaStore((s) => s.persona);
  if (persona !== 'buyer') return null;

  const handleClick = () => {
    const target = document.querySelector<HTMLElement>(
      '[data-tour-section="true-cost"]'
    );
    if (!target) return;
    const trigger = target.querySelector<HTMLButtonElement>(
      'button[aria-expanded]'
    );
    const isOpen = trigger?.getAttribute('aria-expanded') === 'true';
    if (trigger && !isOpen) trigger.click();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('wharescore:highlight-price-inputs')
      );
    }, 450);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-xl bg-piq-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md ring-2 ring-piq-primary/20 transition-all hover:shadow-lg hover:ring-piq-primary/40 active:scale-[0.98]"
      aria-label="Jump to the price analysis section"
    >
      <Calculator className="h-4 w-4" />
      <span className="hidden sm:inline">What&apos;s it worth?</span>
      <span className="sm:hidden">Price</span>
    </button>
  );
}
