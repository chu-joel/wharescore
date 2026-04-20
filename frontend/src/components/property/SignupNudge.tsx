'use client';

import { useEffect, useState } from 'react';
import { X, Heart, FileText } from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  shouldShowSignupNudge,
  markSignupNudgeShown,
  isReturningVisitor,
} from '@/hooks/useVisitTracker';

/**
 * Lightweight signup prompt for unauthenticated users. Sits
 * unobtrusively in the bottom-right, dismissible with ✕ or
 * "Maybe later". Fires once per session.
 *
 * Timing:
 *   - First-time visitor: after 60s on the property page
 *   - Returning visitor:  after 30s (they've already shown interest)
 *
 * Gated by:
 *   - User is anonymous (not signed in)
 *   - `shouldShowSignupNudge()` — not already shown this session
 *
 * Value prop focuses on tangible free-tier benefits:
 *   - Save properties you're shortlisting
 *   - Free shareable report link (Quick Report)
 */
export function SignupNudge() {
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
    // Route through the dedicated /signin page so the user lands on
    // the branded welcome + privacy copy before the Google OAuth
    // round-trip. Matches SavePropertyButton and the rest of the
    // app — all auth entry points funnel through /signin so we
    // have a single place to tweak copy / add providers later.
    const callback = window.location.pathname + window.location.search;
    window.location.href = `/signin?callbackUrl=${encodeURIComponent(callback)}`;
  };

  return (
    <div className="fixed bottom-[4.5rem] right-4 left-4 sm:left-auto sm:max-w-xs z-[9985] animate-in slide-in-from-bottom-4 duration-500">
      <div className="relative rounded-xl border border-border bg-background shadow-xl p-4">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Dismiss signup prompt"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        <div className="pr-6">
          <p className="text-sm font-bold leading-snug">
            Free account, in your corner
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-3 leading-relaxed">
            Sign up to unlock two things, completely free:
          </p>

          <ul className="space-y-1.5 mb-3 text-xs">
            <li className="flex items-start gap-2">
              <Heart className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              <span>
                <span className="font-medium">Save properties</span> you're
                shortlisting and compare them side by side
              </span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="h-3.5 w-3.5 text-piq-primary shrink-0 mt-0.5" />
              <span>
                <span className="font-medium">Generate a shareable report</span>{' '}
                to send to a flatmate, partner or parents
              </span>
            </li>
          </ul>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5"
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={handleSignIn}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-piq-primary text-white px-3 py-1.5 text-xs font-semibold hover:bg-piq-primary-dark transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
