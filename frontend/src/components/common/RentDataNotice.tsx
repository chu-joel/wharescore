'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { readJSON, writeJSON } from '@/lib/storage';

/**
 * First-visit notice informing users that when they enter rent or
 * property details (bedrooms, bathrooms, finish tier, etc.) that data
 * is stored anonymously to build community rent benchmarks.
 *
 * Not a consent gate — once the user has seen the notice, data
 * collection continues even if they close it. Dismissal via the close
 * button or the "Got it" button both set the same localStorage flag.
 * Closing without clicking either still displays the banner next
 * session (so the user definitely sees it at least once).
 *
 * Privacy framing: we store rent + property attributes + hashed IP for
 * rate limiting. No name, email, or account is required. This matches
 * the AnalyticsConsent pattern already in use (same bottom banner, same
 * tone).
 */

export const RENT_NOTICE_VERSION = 'v1';
const STORAGE_KEY = 'ws_rent_notice_seen';

/** Read-only helper for other components that want to attach the
 *  current notice version to a rent submission. */
export function getSeenNoticeVersion(): string | null {
  try {
    return readJSON<string | null>(STORAGE_KEY, null);
  } catch {
    return null;
  }
}

let bannerVisible = false;
export function isRentNoticeVisible() { return bannerVisible; }

export function RentDataNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = readJSON<string | null>(STORAGE_KEY, null);
    if (!seen) {
      setVisible(true);
      bannerVisible = true;
    }
    return () => { bannerVisible = false; };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    writeJSON(STORAGE_KEY, RENT_NOTICE_VERSION);
    setVisible(false);
    bannerVisible = false;
    window.dispatchEvent(new Event('rent-notice-dismissed'));
  };

  return (
    <div
      role="region"
      aria-label="Rent data notice"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border px-4 py-3 flex items-start sm:items-center justify-between gap-4 shadow-lg"
    >
      <p className="text-xs text-muted-foreground max-w-3xl">
        <strong className="text-foreground">Heads up — </strong>
        when you enter rent or property details (bedrooms, bathrooms, finish,
        etc.) we store them anonymously to help other renters in your area.
        No name, email, or account. Just the numbers, pooled by suburb.{' '}
        <a href="/privacy" className="text-piq-primary hover:underline">
          Privacy policy
        </a>
      </p>
      <Button size="sm" variant="outline" onClick={dismiss} className="shrink-0">
        Got it
      </Button>
    </div>
  );
}
