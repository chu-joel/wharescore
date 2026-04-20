'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { useSavedProperties } from '@/hooks/useSavedProperties';
import { toast } from 'sonner';

interface SavePropertyButtonProps {
  addressId: number;
  fullAddress: string;
  score?: number | null;
  rating?: string | null;
  isMultiUnit?: boolean;
  lng?: number;
  lat?: number;
}

/**
 * Save/bookmark a property. Free but requires sign-in to persist
 * across devices. For anonymous users, saves land in localStorage;
 * for signed-in users they also sync to the `saved_properties`
 * table on the backend, so /account can show them anywhere.
 *
 * Data flow:
 *   click (anon)   → localStorage → landing panel shows it
 *   click (signed) → localStorage + POST /account/saved-properties
 *                    → /account page shows it, landing panel shows it
 *   sign in after saves → one-time merge from server on mount
 */
export function SavePropertyButton({
  addressId,
  fullAddress,
  score = null,
  rating = null,
  isMultiUnit = false,
  lng,
  lat,
}: SavePropertyButtonProps) {
  const { data: session } = useSession();
  const isSignedIn = !!session?.user;
  const { getToken } = useAuthToken();
  const { isSaved, toggle, mergeFromServer } = useSavedProperties();
  const [loading, setLoading] = useState(false);

  // On sign-in (or mount if already signed in), pull server-side
  // saves and merge into local. Silent on failure. the user can
  // still save normally.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const res = await fetch('/api/v1/account/saved-properties', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          items: { address_id: number; full_address: string; saved_at: string }[];
        };
        if (cancelled || !Array.isArray(data.items)) return;
        mergeFromServer(
          data.items.map((i) => ({
            addressId: i.address_id,
            fullAddress: i.full_address,
            savedAt: new Date(i.saved_at).getTime() || Date.now(),
          })),
        );
      } catch {
        // Non-critical; local saves still work
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, mergeFromServer]);

  const saved = isSaved(addressId);

  const handleSave = async () => {
    if (!isSignedIn) {
      // Go through Google sign-in; callbackUrl brings the user back
      // to this exact property page so the save completes naturally.
      const callback = window.location.pathname + window.location.search;
      window.location.href = `/signin?callbackUrl=${encodeURIComponent(callback)}`;
      return;
    }

    const wasSaved = saved;

    // Optimistic local toggle first. instant UI feedback
    toggle({
      addressId,
      fullAddress,
      score,
      rating,
      isMultiUnit,
      lng,
      lat,
    });

    // Background sync to backend. Failure doesn't unroll the
    // optimistic local change; worst case the next device-sync
    // after a refresh reconciles.
    setLoading(true);
    try {
      const token = await getToken();
      if (token) {
        if (wasSaved) {
          await fetch(`/api/v1/account/saved-properties/${addressId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        } else {
          await fetch('/api/v1/account/saved-properties', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ address_id: addressId, full_address: fullAddress }),
          });
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }

    if (wasSaved) {
      toast('Property removed from saved');
    } else {
      toast.success('Property saved. View it anytime on your account page.');
    }
  };

  const tip = saved
    ? 'Click to remove from your saved properties'
    : isSignedIn
      ? 'Save this property to your account'
      : 'Sign in to save this property';

  return (
    <button
      onClick={handleSave}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-full px-3 py-2.5 min-h-[44px] text-xs font-medium transition-all hover:bg-muted"
      aria-label={tip}
      aria-pressed={saved}
      title={tip}
    >
      <Heart
        className={`h-4 w-4 transition-colors ${
          saved
            ? 'fill-red-500 text-red-500'
            : 'text-muted-foreground hover:text-red-400'
        }`}
      />
      <span className="text-muted-foreground">
        {loading ? 'Saving...' : saved ? 'Saved' : isSignedIn ? 'Save' : 'Sign in to save'}
      </span>
    </button>
  );
}
