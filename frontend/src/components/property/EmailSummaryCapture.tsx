'use client';

import { useState } from 'react';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { toast } from 'sonner';

interface EmailSummaryCaptureProps {
  addressId: number;
  fullAddress: string;
  /** Number of findings to tease in the email */
  findingCount: number;
  riskCount: number;
}

/**
 * "Email me a summary". registration wall before paywall.
 * User gets a short summary emailed. We get their email for nurture campaigns.
 * If already signed in, sends immediately. If not, triggers Google sign-in.
 */
export function EmailSummaryCapture({ addressId, fullAddress, findingCount, riskCount }: EmailSummaryCaptureProps) {
  const { data: session } = useSession();
  const isSignedIn = !!session?.user;
  const { getToken } = useAuthToken();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!isSignedIn) {
      window.location.href = `/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/v1/account/email-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address_id: addressId }),
      });

      if (res.ok) {
        setSent(true);
        toast.success('Summary sent to your email!');
      } else {
        toast.error('Failed to send summary. Try again later.');
      }
    } catch {
      toast.error('Failed to send summary. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
        <CheckCircle className="h-3.5 w-3.5" />
        <span>Summary sent to {session?.user?.email}</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 min-h-[44px] text-xs text-muted-foreground hover:text-piq-primary transition-colors disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Mail className="h-3.5 w-3.5" />
      )}
      <span className="underline underline-offset-2 decoration-dotted">
        {loading ? 'Sending summary...' : isSignedIn ? 'Email me a summary' : 'Sign in to email summary'}
      </span>
    </button>
  );
}
