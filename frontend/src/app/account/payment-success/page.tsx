'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { showPaymentToast } from '@/components/common/PaymentToast';

type Stage = 'waiting' | 'generating' | 'done' | 'fallback';

export default function PaymentSuccessPage() {
  const { getToken } = useAuthToken();
  const setUser = useDownloadGateStore((s) => s.setUser);
  const [plan, setPlan] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('waiting');
  const [reportUrl, setReportUrl] = useState<string | null>(null);
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
      if (cancelled || attempt > 5) {
        // Give up waiting — show fallback UI
        if (!cancelled) setStage((s) => s === 'waiting' ? 'fallback' : s);
        return;
      }

      await new Promise((r) => setTimeout(r, 2000 * attempt));
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
        showPaymentToast('payment_success', data.credits_remaining ?? undefined);
      } catch {
        if (!cancelled) fetchCredits(attempt + 1);
      }
    }

    fetchCredits(1);
    return () => { cancelled = true; };
  }, [getToken, setUser]);

  // Step 2: Auto-generate report once we have credits + addressId
  useEffect(() => {
    if (!plan || plan === 'free' || !addressId || generationStarted.current) return;
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

          if (status.status === 'completed' && status.share_url) {
            // Clean up localStorage
            try { localStorage.removeItem('wharescore-checkout-target'); } catch {}
            setReportUrl(status.share_url);
            setStage('done');
            // Deduct credit in store
            const gate = useDownloadGateStore.getState();
            if (gate.credits?.plan === 'pro') {
              gate.recordDownload();
            } else {
              gate.deductCredit();
            }
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
          {plan ? (
            <p className="text-muted-foreground">{planLabel}</p>
          ) : (
            <p className="text-muted-foreground animate-pulse">Loading your credits...</p>
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

        {/* Report ready — link to hosted version */}
        {stage === 'done' && reportUrl && (
          <div className="space-y-3">
            <a
              href={reportUrl}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              View your report
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/account"
              className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border bg-background font-medium hover:bg-muted transition-colors text-sm"
            >
              View your account
            </a>
          </div>
        )}

        {/* Fallback: no addressId saved, or generation failed */}
        {(stage === 'fallback' || (stage === 'waiting' && !addressId)) && plan && (
          <div className="space-y-3">
            <a
              href={addressId ? `/property/${addressId}` : '/'}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              {addressId ? 'Go to your property report' : 'Browse properties'}
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/account"
              className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border bg-background font-medium hover:bg-muted transition-colors text-sm"
            >
              View your account
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
