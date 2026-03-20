'use client';

import { useCallback, useRef } from 'react';

/**
 * Drop-in replacement for Clerk's useAuth().getToken().
 * Fetches a short-lived HS256 JWT from /api/auth/token
 * and caches it for 4 minutes (tokens expire in 5).
 */
export function useAuthToken() {
  const cacheRef = useRef<{ token: string; expiresAt: number } | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    // Return cached token if still valid (with 60s buffer)
    if (cacheRef.current && Date.now() < cacheRef.current.expiresAt) {
      return cacheRef.current.token;
    }

    try {
      const res = await fetch('/api/auth/token');
      if (!res.ok) return null;
      const { token } = await res.json();
      // Cache for 4 minutes (token lasts 5)
      cacheRef.current = { token, expiresAt: Date.now() + 4 * 60 * 1000 };
      return token;
    } catch {
      return null;
    }
  }, []);

  return { getToken };
}
