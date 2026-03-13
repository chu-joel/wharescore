'use client';

import { useState, useCallback } from 'react';

const HINT_KEYS = {
  score: 'hint_score_seen',
  accordion: 'hint_accordion_seen',
  layer: 'hint_layer_seen',
  showOnMap: 'hint_show_on_map_seen',
} as const;

type HintKey = keyof typeof HINT_KEYS;

export function useFirstUseHints() {
  const [seen, setSeen] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    const result: Record<string, boolean> = {};
    for (const [key, storageKey] of Object.entries(HINT_KEYS)) {
      result[key] = localStorage.getItem(storageKey) === 'true';
    }
    return result;
  });

  const dismiss = useCallback((hint: HintKey) => {
    setSeen((prev) => ({ ...prev, [hint]: true }));
    localStorage.setItem(HINT_KEYS[hint], 'true');
  }, []);

  const shouldShow = useCallback(
    (hint: HintKey) => !seen[hint],
    [seen],
  );

  return { shouldShow, dismiss };
}
