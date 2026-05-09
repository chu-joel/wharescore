'use client';

import { useEffect, useState } from 'react';
import { X, Heart, FileText, GitCompare } from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  shouldShowSignupNudge,
  markSignupNudgeShown,
  isReturningVisitor,
} from '@/hooks/useVisitTracker';

/**
 * Signup nudge for anonymous users. Same trigger logic as classic
 * SignupNudge: 60s for first-time visitors, 30s for returning. Sign-in
 * routes through the dedicated /signin page (callback preserves /new).
 */
export function SignupNudgeNew() {
  const { data: session, status } = useSession();
  const isSignedIn = !!session?.user || status === 'authenticated';
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isSignedIn || dismissed) return;
    if (status === 'loading') return;
    if (!shouldShowSignupNudge()) return;
    const delay = isReturningVisitor() ? 30_000 : 60_000;
    const t = setTimeout(() => {
      setVisible(true);
      markSignupNudgeShown();
    }, delay);
    return () => clearTimeout(t);
  }, [isSignedIn, dismissed, status]);

  if (isSignedIn || dismissed || !visible) return null;

  const handleSignIn = () => {
    const callback = window.location.pathname + window.location.search;
    window.location.href = `/signin?callbackUrl=${encodeURIComponent(callback)}`;
  };

  return (
    <div
      style={{
        position: 'fixed', zIndex: 9985,
        bottom: '4.5rem', right: 16, left: 16,
        maxWidth: 'min(320px, calc(100vw - 32px))', marginLeft: 'auto',
        animation: 'wsSlideUp 500ms cubic-bezier(.22,1,.36,1) both',
      }}
    >
      <div style={{
        position: 'relative',
        background: 'var(--ws-surface)',
        border: '1px solid var(--ws-rule)',
        borderRadius: 'var(--ws-radius)',
        padding: 14,
        boxShadow: 'var(--ws-shadow-lg)',
      }}>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss signup prompt"
          style={{
            position: 'absolute', top: 6, right: 6,
            width: 28, height: 28, borderRadius: 999,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 0, cursor: 'pointer',
            color: 'var(--ws-ink-mute)',
          }}
        >
          <X size={14} />
        </button>

        <div style={{ paddingRight: 24 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ws-ink)', lineHeight: 1.3 }}>
            Free account, in your corner
          </p>
          <p style={{ margin: '4px 0 12px', fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.5 }}>
            Sign up to unlock three things, completely free:
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'grid', gap: 6, fontSize: 12 }}>
            <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <GitCompare size={14} style={{ color: 'var(--ws-piq)', marginTop: 2, flexShrink: 0 }} />
              <span><span style={{ fontWeight: 500 }}>Compare properties side by side</span> — risk, rent, transport, planning, all on one page</span>
            </li>
            <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Heart size={14} style={{ color: 'var(--ws-r-vhigh)', marginTop: 2, flexShrink: 0 }} />
              <span><span style={{ fontWeight: 500 }}>Save properties</span> you&rsquo;re shortlisting across devices</span>
            </li>
            <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <FileText size={14} style={{ color: 'var(--ws-piq)', marginTop: 2, flexShrink: 0 }} />
              <span><span style={{ fontWeight: 500 }}>Generate a shareable report</span> to send to a flatmate, partner or parents</span>
            </li>
          </ul>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="ws-btn ws-btn-ghost"
              style={{ fontSize: 12, padding: '0 10px' }}
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={handleSignIn}
              className="ws-btn ws-btn-primary"
              style={{ flex: 1, justifyContent: 'center', fontSize: 12, fontWeight: 600 }}
            >
              Create free account
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes wsSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
