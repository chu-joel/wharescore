import { useCallback } from 'react';

/**
 * Simple history state management for mobile bottom sheet.
 * Push state when expanding, pop when collapsing via back button.
 */
export function useMobileBackButton() {
  const pushState = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.history.pushState({ sheet: true }, '');
  }, []);

  const popState = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.history.state?.sheet) {
      window.history.back();
    }
  }, []);

  return { pushState, popState };
}
