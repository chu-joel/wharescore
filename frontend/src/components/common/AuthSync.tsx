'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { useAuthToken } from '@/hooks/useAuthToken';

/**
 * Syncs Auth.js session state → downloadGateStore.
 * Fetches credits from backend on login, clears on logout.
 */
export function AuthSync() {
  const { data: session, status } = useSession();
  const { getToken } = useAuthToken();
  const setUser = useDownloadGateStore((s) => s.setUser);
  const clearUser = useDownloadGateStore((s) => s.clearUser);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      clearUser();
      return;
    }

    // Authenticated — fetch credits from backend
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const res = await fetch('/api/v1/account/credits', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          // User might not be in DB yet — set as free
          setUser({
            plan: 'free',
            creditsRemaining: null,
            quickCredits: 0,
            fullCredits: 0,
            dailyLimit: null,
            monthlyLimit: null,
            downloadsToday: 0,
            downloadsThisMonth: 0,
          });
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setUser({
          plan: data.plan,
          creditsRemaining: data.credits_remaining,
          quickCredits: data.quick_credits ?? 0,
          fullCredits: data.full_credits ?? 0,
          dailyLimit: data.daily_limit,
          monthlyLimit: data.monthly_limit,
          downloadsToday: data.downloads_today,
          downloadsThisMonth: data.downloads_this_month,
        });
      } catch {
        if (!cancelled) {
          setUser({
            plan: 'free',
            creditsRemaining: null,
            quickCredits: 0,
            fullCredits: 0,
            dailyLimit: null,
            monthlyLimit: null,
            downloadsToday: 0,
            downloadsThisMonth: 0,
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [status, session?.user?.id, getToken, setUser, clearUser]);

  return null;
}
