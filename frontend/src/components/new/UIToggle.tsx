'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const KEY = 'ws-ui-version';

/**
 * Sticky UI version toggle. Lets users flip between the existing app and the
 * new one at /new/. Persists the choice in localStorage so subsequent visits
 * to either root land on the right tree.
 *
 * Uses window.location.assign rather than router.push because the two trees
 * have different layouts (different tokens, different chrome) — a soft
 * client-side navigation can leave stale layout in place. Hard navigation
 * also avoids a benign Next.js Performance.measure warning that fires when
 * we push between routes that share a layout segment but render different
 * scopes.
 */
export function UIToggle({ here }: { here: 'old' | 'new' }) {
  const pathname = usePathname() || '/';

  useEffect(() => {
    try {
      localStorage.setItem(KEY, here);
    } catch { /* private mode etc */ }
  }, [here]);

  const flip = () => {
    const next = here === 'new' ? 'old' : 'new';
    try { localStorage.setItem(KEY, next); } catch {}
    const search = typeof window !== 'undefined' ? window.location.search : '';
    let target: string;
    if (here === 'new') {
      target = (pathname.replace(/^\/new/, '') || '/') + search;
    } else {
      target = (pathname === '/' ? '/new' : `/new${pathname}`) + search;
    }
    if (typeof window !== 'undefined') {
      window.location.assign(target);
    }
  };

  const label = here === 'new' ? 'Try classic UI' : 'Try new UI';

  return (
    <button
      onClick={flip}
      className={here === 'new' ? 'ws-btn ws-btn-outline' : ''}
      style={
        here === 'old'
          ? {
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #0D7377, #2BA9AE)',
              color: '#fff',
              border: 0,
              cursor: 'pointer',
              minHeight: 32,
            }
          : undefined
      }
      aria-label={label}
      title={label}
    >
      {label}
    </button>
  );
}
