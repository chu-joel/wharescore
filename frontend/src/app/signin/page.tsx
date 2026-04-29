'use client';

import { signIn } from 'next-auth/react';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, ArrowLeft, Shield, TrendingUp, MapPin, GitCompare } from 'lucide-react';

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  // Detect a compare-driven sign-in flow so we can lead with comparison
  // copy instead of the generic value prop. The AddToCompareButton
  // encodes ?compareAdd=<id> in the callback when a 2nd property triggers
  // the gate; /compare?ids=A,B is the direct-link case.
  const isCompareFlow =
    callbackUrl.includes('compareAdd=') ||
    callbackUrl.startsWith('/compare') ||
    callbackUrl.includes('%2Fcompare');
  const [mode, setMode] = useState<'choose' | 'email' | 'code'>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to send code');
      }

      setMode('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    setError('');

    try {
      const result = await signIn('email-otp', {
        email,
        code,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid or expired code. Try again.');
        setCode('');
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-start sm:items-center justify-center pt-[15vh] sm:pt-0">
      <div className="mx-auto max-w-sm px-4 text-center">
        <img src="/wharescore-logo.png" alt="WhareScore" width={48} height={45} className="mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">
          {isCompareFlow ? 'Sign in to compare' : 'Sign in to WhareScore'}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isCompareFlow
            ? 'Free with an account, takes about 10 seconds. Your staged properties are waiting on the other side.'
            : 'Sign in to save reports, track properties, and access premium features.'}
        </p>

        {mode === 'choose' && (
          <div className="space-y-3">
            <Button
              onClick={() => signIn('google', { callbackUrl })}
              className="w-full"
              size="lg"
              variant="outline"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              onClick={() => setMode('email')}
              className="w-full"
              size="lg"
              variant="outline"
            >
              <Mail className="h-5 w-5 mr-2" />
              Continue with email
            </Button>

            <p className="text-xs text-muted-foreground mt-2">
              New to WhareScore? Signing in creates your account automatically.
            </p>
          </div>
        )}

        {mode === 'email' && (
          <form onSubmit={handleSendCode} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-piq-primary"
            />
            <Button type="submit" className="w-full" size="lg" disabled={loading || !email}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send sign-in code
            </Button>
            <button
              type="button"
              onClick={() => { setMode('choose'); setError(''); }}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          </form>
        )}

        {mode === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <p className="text-sm text-muted-foreground mb-2">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              autoFocus
              maxLength={6}
              inputMode="numeric"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-center text-xl sm:text-2xl font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-piq-primary"
            />
            <Button type="submit" className="w-full" size="lg" disabled={loading || code.length !== 6}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign in
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={() => { setMode('email'); setCode(''); setError(''); }}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Change email
              </button>
              <button
                type="button"
                onClick={() => { setCode(''); handleSendCode(new Event('click') as unknown as React.FormEvent); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        {error && (
          <p className="text-sm text-red-500 mt-3">{error}</p>
        )}

        {mode === 'choose' && (
          <div className="mt-10 pt-6 border-t border-border space-y-3 text-left">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">What you get with an account</p>
            {/* Lead bullet swaps for compare flows so the gate's payoff
                is named explicitly. */}
            {isCompareFlow ? (
              <div className="flex items-start gap-3 rounded-md bg-piq-primary/5 border border-piq-primary/20 p-3">
                <GitCompare className="h-4 w-4 text-piq-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Compare properties side by side</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Risk, rent, transport, planning, demographics — every metric
                    aligned in one view, with a head-to-head verdict at the top.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <GitCompare className="h-4 w-4 text-piq-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">Compare properties side by side with a head-to-head verdict</p>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-piq-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">Free Quick Reports with key findings and a shareable link</p>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="h-4 w-4 text-piq-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">Save properties and track changes over time</p>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-piq-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">Access full reports with AI summary and rent advice</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
