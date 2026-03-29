import { create } from 'zustand';
import type { CoverageInfo } from '@/lib/types';

/**
 * Download gate store — controls paywall for PDF exports.
 *
 * Free users: can browse on-screen, no PDF downloads.
 * Paid users: credits-based (single/3-pack) or Pro (10/day, 30/month).
 *
 * Integration points (TODO when adding Clerk + Stripe):
 *   - Call `setUser()` after Clerk sign-in with user data from backend.
 *   - Call `deductCredit()` after successful PDF generation.
 *   - Call `clearUser()` on sign-out.
 */

export type PlanType = 'free' | 'quick_single' | 'full_single' | 'pro' | 'promo' | 'single' | 'pack3';

interface UserCredits {
  plan: PlanType;
  creditsRemaining: number | null; // null for pro (uses limits)
  quickCredits: number;            // credits for quick-tier reports
  fullCredits: number;             // credits for full-tier reports
  dailyLimit: number | null;       // 10 for pro
  monthlyLimit: number | null;     // 30 for pro
  downloadsToday: number;
  downloadsThisMonth: number;
}

/** Context for why the upgrade modal was triggered — drives headline copy */
export type ModalTrigger = 'default' | 'risk' | 'market' | 'rent-advisor' | 'price-advisor' | 'no_credits' | 'daily_limit' | 'monthly_limit' | 'comparing';

interface DownloadGateState {
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** User's credit/plan info */
  credits: UserCredits | null;
  /** Whether the upgrade modal is open */
  showUpgradeModal: boolean;
  /** What triggered the modal — for contextual headlines */
  modalTrigger: ModalTrigger;
  /** Extra context (e.g. risk count) */
  modalContext: Record<string, number | string>;
  /** Target address for guest checkout */
  targetAddressId: number | null;
  /** Target persona for guest checkout */
  targetPersona: string;
  /** Coverage info for current property (used by UpgradeModal) */
  coverage: CoverageInfo | null;
  setCoverage: (c: CoverageInfo | null) => void;

  /** Check if user can download right now */
  canDownload: () => { allowed: boolean; reason: string };

  /** Set user data after auth + credit check */
  setUser: (credits: UserCredits) => void;
  /** Clear on sign-out */
  clearUser: () => void;
  /** Deduct 1 credit after successful download (credit-based plans) */
  deductCredit: (tier?: 'quick' | 'full') => void;
  /** Increment download counters (pro plan) */
  recordDownload: () => void;
  /** Toggle upgrade modal with optional trigger context */
  setShowUpgradeModal: (show: boolean, trigger?: ModalTrigger, context?: Record<string, number | string>, addressId?: number | null, persona?: string) => void;
  /** Redeem a promo code via backend — returns { success, message } */
  redeemPromo: (code: string) => Promise<{ success: boolean; message: string }>;
}

export const useDownloadGateStore = create<DownloadGateState>((set, get) => ({
  isAuthenticated: false,
  credits: null,
  showUpgradeModal: false,
  modalTrigger: 'default' as ModalTrigger,
  modalContext: {},
  targetAddressId: null,
  targetPersona: 'buyer',
  coverage: null,
  setCoverage: (c) => set({ coverage: c }),

  canDownload: () => {
    const { isAuthenticated, credits } = get();

    // Not logged in
    if (!isAuthenticated || !credits) {
      return { allowed: false, reason: 'login' };
    }

    // Free plan — never
    if (credits.plan === 'free') {
      return { allowed: false, reason: 'upgrade' };
    }

    // Credit-based plans (single, pack3, promo)
    if (credits.plan === 'single' || credits.plan === 'pack3' || credits.plan === 'promo') {
      if ((credits.creditsRemaining ?? 0) <= 0) {
        return { allowed: false, reason: 'no_credits' };
      }
      return { allowed: true, reason: '' };
    }

    // Pro plan — check daily + monthly limits
    if (credits.plan === 'pro') {
      if (credits.monthlyLimit && credits.downloadsThisMonth >= credits.monthlyLimit) {
        return {
          allowed: false,
          reason: `Monthly limit reached (${credits.monthlyLimit} reports). Resets next month.`,
        };
      }
      if (credits.dailyLimit && credits.downloadsToday >= credits.dailyLimit) {
        return {
          allowed: false,
          reason: `Daily limit reached (${credits.dailyLimit} reports). Resets at midnight.`,
        };
      }
      return { allowed: true, reason: '' };
    }

    return { allowed: false, reason: 'upgrade' };
  },

  setUser: (credits) => set({ isAuthenticated: true, credits }),

  clearUser: () => set({ isAuthenticated: false, credits: null }),

  deductCredit: (tier?: 'quick' | 'full') => {
    const { credits } = get();
    if (!credits || credits.creditsRemaining === null) return;
    const updatedCredits = {
      ...credits,
      creditsRemaining: Math.max(0, credits.creditsRemaining - 1),
    };
    if (tier === 'quick') {
      updatedCredits.quickCredits = Math.max(0, credits.quickCredits - 1);
    } else if (tier === 'full') {
      updatedCredits.fullCredits = Math.max(0, credits.fullCredits - 1);
    }
    set({ credits: updatedCredits });
  },

  recordDownload: () => {
    const { credits } = get();
    if (!credits) return;
    set({
      credits: {
        ...credits,
        downloadsToday: credits.downloadsToday + 1,
        downloadsThisMonth: credits.downloadsThisMonth + 1,
      },
    });
  },

  setShowUpgradeModal: (show, trigger = 'default', context = {}, addressId = null, persona = 'buyer') =>
    set({
      showUpgradeModal: show,
      modalTrigger: trigger,
      modalContext: context,
      ...(addressId !== null ? { targetAddressId: addressId, targetPersona: persona } : {}),
    }),

  redeemPromo: async (code: string) => {
    try {
      // Fetch Bearer token for authenticated request
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const tokenRes = await fetch('/api/auth/token');
        if (tokenRes.ok) {
          const { token } = await tokenRes.json();
          if (token) headers['Authorization'] = `Bearer ${token}`;
        }
      } catch { /* proceed without token */ }

      const res = await fetch('/api/v1/account/redeem-promo', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code }),
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'sign_in_required' };
      }
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.detail || 'Invalid promo code' };
      }
      // Update local state with server response
      const { credits: currentCredits } = get();
      const promoTier = data.report_tier as 'quick' | 'full' | undefined;
      set({
        isAuthenticated: true,
        credits: {
          plan: 'promo',
          creditsRemaining: data.credits_remaining ?? (currentCredits?.creditsRemaining ?? 0) + 1,
          quickCredits: (currentCredits?.quickCredits ?? 0) + (promoTier === 'quick' ? 1 : 0),
          fullCredits: (currentCredits?.fullCredits ?? 0) + (promoTier !== 'quick' ? 1 : 0),
          dailyLimit: null,
          monthlyLimit: null,
          downloadsToday: currentCredits?.downloadsToday ?? 0,
          downloadsThisMonth: currentCredits?.downloadsThisMonth ?? 0,
        },
      });
      return { success: true, message: data.message || '1 free report unlocked!' };
    } catch {
      return { success: false, message: 'Failed to redeem code. Please try again.' };
    }
  },
}));
