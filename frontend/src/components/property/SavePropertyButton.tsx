'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { toast } from 'sonner';

interface SavePropertyButtonProps {
  addressId: number;
  fullAddress: string;
}

/**
 * Save/bookmark a property — free but requires sign-in.
 * This is a commitment escalation step: Search → View → Save (sign-in) → Download (pay).
 */
export function SavePropertyButton({ addressId, fullAddress }: SavePropertyButtonProps) {
  const { data: session } = useSession();
  const isSignedIn = !!session?.user;
  const { getToken } = useAuthToken();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if already saved on mount
  useEffect(() => {
    if (!isSignedIn) return;
    const savedIds = JSON.parse(localStorage.getItem('wharescore_saved') ?? '[]') as number[];
    if (savedIds.includes(addressId)) {
      setSaved(true);
    }
  }, [isSignedIn, addressId]);

  const handleSave = async () => {
    if (!isSignedIn) {
      window.location.href = `/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    if (saved) {
      // Unsave
      const savedIds = JSON.parse(localStorage.getItem('wharescore_saved') ?? '[]') as number[];
      localStorage.setItem(
        'wharescore_saved',
        JSON.stringify(savedIds.filter((id: number) => id !== addressId)),
      );
      setSaved(false);
      toast('Property removed from saved');
      return;
    }

    setLoading(true);
    try {
      // Save locally
      const savedIds = JSON.parse(localStorage.getItem('wharescore_saved') ?? '[]') as number[];
      if (!savedIds.includes(addressId)) {
        savedIds.push(addressId);
        localStorage.setItem('wharescore_saved', JSON.stringify(savedIds));
      }

      // Also save to backend if possible
      try {
        const token = await getToken();
        if (token) {
          await fetch('/api/v1/account/saved-properties', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ address_id: addressId, full_address: fullAddress }),
          });
        }
      } catch {
        // Local save is fine even if backend fails
      }

      setSaved(true);
      toast.success('Property saved! View it anytime from My Reports.');
    } finally {
      setLoading(false);
    }
  };

  const tip = saved
    ? 'Click to remove from your saved properties'
    : isSignedIn
      ? 'Save this property to My Reports'
      : 'Sign in to save this property to My Reports';

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
