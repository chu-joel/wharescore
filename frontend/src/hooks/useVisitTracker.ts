/**
 * Tracks property visits within a session.
 * Used to detect second-visit → show "Comparing properties?" upsell.
 */

const SESSION_KEY = 'wharescore_visited';
const UPSELL_SHOWN_KEY = 'wharescore_upsell_shown';
const SCROLL_PROMPT_SHOWN_KEY = 'wharescore_scroll_prompt_shown';

function getVisited(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function trackVisit(addressId: number): void {
  const visited = getVisited();
  if (!visited.includes(addressId)) {
    visited.push(addressId);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(visited));
  }
}

export function getVisitCount(): number {
  return getVisited().length;
}

export function isSecondVisit(): boolean {
  return getVisited().length >= 2;
}

/** Returns true only once per session — use to gate the "comparing" upsell. */
export function shouldShowComparisonUpsell(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isSecondVisit()) return false;
  if (sessionStorage.getItem(UPSELL_SHOWN_KEY)) return false;
  sessionStorage.setItem(UPSELL_SHOWN_KEY, '1');
  return true;
}

/** Returns true only once per session — use to gate the scroll prompt. */
export function shouldShowScrollPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(SCROLL_PROMPT_SHOWN_KEY)) return false;
  return true;
}

export function markScrollPromptShown(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SCROLL_PROMPT_SHOWN_KEY, '1');
  }
}
