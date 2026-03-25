'use client';

import { useEffect, useState } from 'react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { CheckCircle, ArrowRight } from 'lucide-react';
// Using inline link styles instead of Button asChild
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { showPaymentToast } from '@/components/common/PaymentToast';

export default function PaymentSuccessPage() {
  const { getToken } = useAuthToken();
  const setUser = useDownloadGateStore((s) => s.setUser);
  const targetAddressId = useDownloadGateStore((s) => s.targetAddressId);
  const [creditsLoaded, setCreditsLoaded] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCredits(attempt: number) {
      if (cancelled || attempt > 5) {
        setCreditsLoaded(true);
        return;
      }

      // Exponential backoff: 2s, 4s, 6s, 8s, 10s (covers up to ~30s webhook delay)
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      if (cancelled) return;

      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const res = await fetch('/api/v1/account/credits', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          // Retry — webhook may not have processed yet
          fetchCredits(attempt + 1);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        // If still on free plan, webhook hasn't processed — retry
        if (data.plan === 'free' && attempt < 5) {
          fetchCredits(attempt + 1);
          return;
        }

        setPlan(data.plan);
        setUser({
          plan: data.plan,
          creditsRemaining: data.credits_remaining,
          dailyLimit: data.daily_limit,
          monthlyLimit: data.monthly_limit,
          downloadsToday: data.downloads_today,
          downloadsThisMonth: data.downloads_this_month,
        });
        setCreditsLoaded(true);
        showPaymentToast('payment_success', data.credits_remaining ?? undefined);
      } catch {
        if (!cancelled) fetchCredits(attempt + 1);
      }
    }

    fetchCredits(1);
    return () => { cancelled = true; };
  }, [getToken, setUser]);

  const planLabel = plan === 'pro' ? 'Pro plan activated' :
    plan === 'pack3' ? '3 report credits' :
    plan === 'single' ? '1 property report credit' :
    'Credits added';

  return (
    <div className="min-h-screen bg-background pt-14 flex items-center justify-center">
      <div className="mx-auto max-w-md px-4 text-center">
        <div className="mb-6 animate-in zoom-in-50 duration-500">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Thank you for your purchase!</h1>
          {creditsLoaded ? (
            <p className="text-muted-foreground">{planLabel}</p>
          ) : (
            <p className="text-muted-foreground animate-pulse">Loading your credits...</p>
          )}
        </div>

        <div className="space-y-3">
          <a
            href={targetAddressId ? `/property/${targetAddressId}` : '/'}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Download your report now
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/account"
            className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border bg-background font-medium hover:bg-muted transition-colors text-sm"
          >
            View your account
          </a>
        </div>
      </div>
    </div>
  );
}
