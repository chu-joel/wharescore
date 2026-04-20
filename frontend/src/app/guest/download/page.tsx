'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Download, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';
import { signIn } from 'next-auth/react';

type Stage = 'loading' | 'exchanging' | 'generating' | 'ready' | 'error';

export default function GuestDownloadPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-piq-primary" />
      </div>
    }>
      <GuestDownloadContent />
    </Suspense>
  );
}

function GuestDownloadContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [addressId, setAddressId] = useState<number | null>(null);

  const startProcess = useCallback(async () => {
    if (!sessionId) {
      setStage('error');
      setError('Missing session ID. Please check your payment confirmation email.');
      return;
    }

    try {
      // Step 1: Exchange session_id for download token
      setStage('exchanging');
      const tokenRes = await fetch(`/api/v1/checkout/guest-token?session_id=${encodeURIComponent(sessionId)}`);

      if (tokenRes.status === 410) {
        setStage('error');
        setError('This download link has already been used. If you need help, contact support.');
        return;
      }
      if (tokenRes.status === 404) {
        // Payment may still be processing. retry with exponential backoff
        // Stripe webhooks can take up to 30s to arrive
        for (let attempt = 1; attempt <= 5; attempt++) {
          await new Promise(r => setTimeout(r, 2000 * attempt)); // 2s, 4s, 6s, 8s, 10s
          const retryRes = await fetch(`/api/v1/checkout/guest-token?session_id=${encodeURIComponent(sessionId)}`);
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            setToken(retryData.token);
            setAddressId(retryData.address_id);
            await startPdfGeneration(retryData.address_id, retryData.token);
            return;
          }
          if (retryRes.status !== 404) break; // non-retriable error
        }
        setStage('error');
        setError('Payment is still processing. Please refresh this page in a minute.');
        return;
      }
      if (!tokenRes.ok) {
        throw new Error('Failed to verify purchase');
      }

      const tokenData = await tokenRes.json();
      setToken(tokenData.token);
      setAddressId(tokenData.address_id);

      // Step 2: Start PDF generation
      await startPdfGeneration(tokenData.address_id, tokenData.token);
    } catch (err) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [sessionId]);

  const startPdfGeneration = async (addrId: number, tkn: string) => {
    setStage('generating');

    // Read saved user inputs from localStorage (saved before Stripe redirect)
    let inputsBody: string | undefined;
    try {
      const saved = localStorage.getItem('wharescore-guest-inputs');
      if (saved) {
        inputsBody = saved;
        localStorage.removeItem('wharescore-guest-inputs'); // one-time use
      }
    } catch { /* localStorage may be unavailable */ }

    const startRes = await fetch(
      `/api/v1/property/${addrId}/export/pdf/guest-start?token=${encodeURIComponent(tkn)}`,
      {
        method: 'POST',
        headers: inputsBody ? { 'Content-Type': 'application/json' } : undefined,
        body: inputsBody,
      },
    );
    if (!startRes.ok) {
      const body = await startRes.json().catch(() => ({ detail: 'Failed to start report generation' }));
      throw new Error(body.detail || 'Failed to start report generation');
    }

    const { job_id, download_url } = await startRes.json();

    // Step 3: Poll for completion
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 1500));

      const statusRes = await fetch(`/api/v1/property/${addrId}/export/pdf/status/${job_id}`);
      if (!statusRes.ok) continue;

      const status = await statusRes.json();

      if (status.status === 'completed') {
        setDownloadUrl(`${download_url}?token=${encodeURIComponent(tkn)}`);
        setStage('ready');
        return;
      }

      if (status.status === 'failed') {
        throw new Error(status.error ?? 'Report generation failed');
      }
    }

    throw new Error('Report generation timed out. Please refresh and try again.');
  };

  useEffect(() => {
    startProcess();
  }, [startProcess]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-5 sm:p-8 shadow-lg">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold">Your WhareScore Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stage === 'loading' && 'Verifying your purchase...'}
            {stage === 'exchanging' && 'Verifying your purchase...'}
            {stage === 'generating' && 'Generating your report. this takes about a minute...'}
            {stage === 'ready' && 'Your report is ready!'}
            {stage === 'error' && 'Something went wrong'}
          </p>
        </div>

        {/* Progress */}
        {(stage === 'loading' || stage === 'exchanging' || stage === 'generating') && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-piq-primary" />
            <div className="space-y-2 text-center">
              <StepIndicator done={stage !== 'loading' && stage !== 'exchanging'} active={stage === 'exchanging'} label="Verifying payment" />
              <StepIndicator done={false} active={stage === 'generating'} label="Generating report" />
            </div>
          </div>
        )}

        {/* Ready */}
        {stage === 'ready' && downloadUrl && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-piq-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-piq-primary/90 hover:shadow-lg"
              >
                <Download className="h-4 w-4" />
                Open Report
              </a>
              <p className="text-xs text-muted-foreground">
                You can download up to 3 times within 72 hours.
              </p>
            </div>

            {/* Account CTA */}
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center">
              <p className="text-sm font-medium">Save this report to your account</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a free account to access your report anytime and save future properties.
              </p>
              <button
                onClick={() => window.location.href = `/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`}
                className="mt-3 flex items-center justify-center gap-2 mx-auto rounded-lg border border-border px-4 py-2 text-sm font-medium transition-all hover:bg-accent"
              >
                <UserPlus className="h-4 w-4" />
                Create account with Google
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
            <button
              onClick={() => { setStage('loading'); setError(null); startProcess(); }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-all hover:bg-accent"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${done ? 'text-green-600 dark:text-green-400' : active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
      {done ? (
        <CheckCircle className="h-4 w-4" />
      ) : active ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
      )}
      {label}
    </div>
  );
}
