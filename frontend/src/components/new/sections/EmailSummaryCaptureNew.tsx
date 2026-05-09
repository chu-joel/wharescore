'use client';

import { useState } from 'react';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { toast } from 'sonner';

interface Props {
  addressId: number;
  fullAddress: string;
  findingCount: number;
  riskCount: number;
}

/**
 * "Email me a summary" — registration nudge before the paywall. Sends a short
 * email summary to the signed-in user; routes to /signin first if anonymous.
 * Same logic as classic; styled with new tokens.
 */
export function EmailSummaryCaptureNew({ addressId }: Props) {
  const { data: session } = useSession();
  const isSignedIn = !!session?.user;
  const { getToken } = useAuthToken();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!isSignedIn) {
      window.location.href = `/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/v1/account/email-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: 'var(--ws-success)',
      }}>
        <CheckCircle size={14} />
        <span>Summary sent to {session?.user?.email}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="ws-btn ws-btn-ghost"
      style={{ minHeight: 44, padding: '0 4px', fontSize: 12 }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
      <span style={{
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        textUnderlineOffset: 2,
      }}>
        {loading ? 'Sending summary…' : isSignedIn ? 'Email me a summary' : 'Sign in to email summary'}
      </span>
    </button>
  );
}
