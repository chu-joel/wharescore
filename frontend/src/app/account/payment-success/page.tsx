'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { showPaymentToast } from '@/components/common/PaymentToast';

type Stage = 'waiting' | 'generating' | 'fallback';

export default function PaymentSuccessPage() {
  const { getToken } = useAuthToken();
  const setUser = useDownloadGateStore((s) => s.setUser);
  const [plan, setPlan] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('waiting');
  const [addressId, setAddressId] = useState<number | null>(null);
  const generationStarted = useRef(false);

  // Read target address from localStorage (saved before Stripe redirect)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wharescore-checkout-target');
      if (saved) {
        const { addressId: aid } = JSON.parse(saved);
        if (aid) setAddressId(aid);
      }
    } catch { /* ignore */ }
  }, []);

  // Step 1: Wait for webhook to process credits
  useEffect(() => {
    let cancelled = false;

    async function fetchCredits(attempt: number) {
      if (cancelled || attempt > 10) {
        // Give up waiting — show fallback UI with whatever plan we have
        if (!cancelled) {
          setPlan((p) => p || 'pending');
          setStage((s) => s === 'waiting' ? 'fallback' : s);
        }
        return;
      }

      // First attempt is quick (1.5s), then back off: 2s, 3s, 4s...
      await new Promise((r) => setTimeout(r, attempt === 1 ? 1500 : 1500 + attempt * 500));
      if (cancelled) return;

      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const res = await fetch('/api/v1/account/credits', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          fetchCredits(attempt + 1);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.plan === 'free' && attempt < 10) {
          fetchCredits(attempt + 1);
          return;
        }

        const resolvedPlan = data.plan === 'free' ? 'pending' : data.plan;
        setPlan(resolvedPlan);
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
        if (data.plan !== 'free') {
          showPaymentToast('payment_success', data.credits_remaining ?? undefined);
        }
      } catch {
        if (!cancelled) fetchCredits(attempt + 1);
      }
    }

    fetchCredits(1);
    return () => { cancelled = true; };
  }, [getToken, setUser]);

  // Step 2: Auto-generate report once we have credits + addressId
  useEffect(() => {
    if (!plan || plan === 'free' || plan === 'pending' || !addressId || generationStarted.current) return;
    generationStarted.current = true;

    let cancelled = false;

    (async () => {
      setStage('generating');
      try {
        const token = await getToken();
        if (!token || cancelled) { setStage('fallback'); return; }

        // Read saved persona
        let persona = 'buyer';
        try {
          const saved = localStorage.getItem('wharescore-checkout-target');
          if (saved) persona = JSON.parse(saved).persona || 'buyer';
        } catch { /* ignore */ }

        const res = await fetch(
          `/api/v1/property/${addressId}/export/pdf/start?persona=${persona}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: '{}',
          },
        );

        if (!res.ok) {
          if (!cancelled) setStage('fallback');
          return;
        }

        const { job_id } = await res.json();

        // Poll for completion
        for (let i = 0; i < 90; i++) {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 2000));

          const statusRes = await fetch(
            `/api/v1/property/${addressId}/export/pdf/status/${job_id}`,
          );
          if (!statusRes.ok) continue;

          const status = await statusRes.json();

          if (status.status === 'completed') {
            // Clean up localStorage
            try { localStorage.removeItem('wharescore-checkout-target'); } catch {}
            // Deduct credit in store
            const gate = useDownloadGateStore.getState();
            if (gate.credits?.plan === 'pro') {
              gate.recordDownload();
            } else {
              gate.deductCredit();
            }
            // Show success — don't navigate, let user go to My Reports
            if (!cancelled) setStage('fallback');
            showPaymentToast('report_generated');
            return;
          }

          if (status.status === 'failed') {
            if (!cancelled) setStage('fallback');
            return;
          }
        }

        // Timed out
        if (!cancelled) setStage('fallback');
      } catch {
        if (!cancelled) setStage('fallback');
      }
    })();

    return () => { cancelled = true; };
  }, [plan, addressId, getToken]);

  const planLabel = plan === 'pro' ? 'Pro plan activated' :
    plan === 'pack3' ? '3 Full report credits' :
    plan === 'single' || plan === 'full_single' ? '1 Full report credit' :
    plan === 'pending' ? 'Payment received' :
    'Credits added';

  return (
    <div className="min-h-screen bg-background pt-14 flex items-center justify-center">
      <div className="mx-auto max-w-md px-4 text-center">
        <div className="mb-6 animate-in zoom-in-50 duration-500">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Thank you for your purchase!</h1>
          {plan && plan !== 'pending' ? (
            <p className="text-muted-foreground">{planLabel}</p>
          ) : plan === 'pending' ? (
            <p className="text-muted-foreground">Your payment is being processed. Credits will appear shortly.</p>
          ) : (
            <p className="text-muted-foreground animate-pulse">Confirming your payment...</p>
          )}
        </div>

        {/* Auto-generating report */}
        {stage === 'generating' && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating your report — this takes about a minute...
            </div>
          </div>
        )}

        {/* Waiting for webhook */}
        {stage === 'waiting' && !plan && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirming payment...
          </div>
        )}

        {/* Report ready or fallback */}
        {(stage === 'fallback' || (plan === 'pending') || (stage === 'waiting' && plan && !addressId)) && (
          <div className="space-y-3">
            {plan === 'pending' ? (
              <p className="text-xs text-muted-foreground mb-2">
                Your payment was received but is still processing. Your credit will be available within a few minutes.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-2">
                We&apos;ll email you a link to your report when it&apos;s ready. You can also find it in My Reports.
              </p>
            )}
            <a
              href="/account"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Go to My Reports
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/"
              className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border bg-background font-medium hover:bg-muted transition-colors text-sm"
            >
              Browse more properties
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
