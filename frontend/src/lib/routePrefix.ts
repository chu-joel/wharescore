'use client';

import { usePathname } from 'next/navigation';

/**
 * When the user is inside the /new namespace, every internal link should keep
 * them there. `usePrefixedPath()('/compare')` returns `/new/compare` if the
 * current pathname starts with `/new`, otherwise `/compare`.
 *
 * Note: only client components can call this. Server components reach here
 * through pathname-aware Link components or thread the prefix manually.
 */
export function usePrefixedPath() {
  const pathname = usePathname() || '/';
  const inNew = pathname.startsWith('/new');
  return (path: string): string => {
    if (!inNew) return path;
    if (path === '/') return '/new';
    if (path.startsWith('/new')) return path;
    return `/new${path}`;
  };
}

/** Pure helper for non-React contexts (event handlers etc.). */
export function prefixPath(currentPathname: string, target: string): string {
  if (!currentPathname.startsWith('/new')) return target;
  if (target === '/') return '/new';
  if (target.startsWith('/new')) return target;
  return `/new${target}`;
}

/**
 * Rewrite a backend-emitted share URL for the current tree. The backend
 * always emits `/report/{token}` (absolute or relative). When the user is
 * inside `/new`, redirect to `/new/report/{token}` so the report opens in
 * the new chrome and they don't fall out of the new UI.
 *
 * Accepts both absolute (https://…/report/x) and relative (/report/x).
 */
export function localizeShareUrl(shareUrl: string | null | undefined): string | null {
  if (!shareUrl) return null;
  if (typeof window === 'undefined') return shareUrl;
  const inNew = window.location.pathname.startsWith('/new');
  if (!inNew) return shareUrl;
  // Absolute URL
  if (/^https?:\/\//i.test(shareUrl)) {
    try {
      const u = new URL(shareUrl);
      if (u.pathname.startsWith('/report/') && !u.pathname.startsWith('/new/')) {
        u.pathname = `/new${u.pathname}`;
      }
      return u.toString();
    } catch { return shareUrl; }
  }
  // Relative path
  if (shareUrl.startsWith('/report/')) return `/new${shareUrl}`;
  return shareUrl;
}
