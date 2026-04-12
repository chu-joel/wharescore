import { create } from 'zustand';
import { usePersonaStore } from './personaStore';
import { useDownloadGateStore } from './downloadGateStore';
import { useBudgetStore } from './budgetStore';
import { useRentInputStore } from './rentInputStore';
import { useBuyerInputStore } from './buyerInputStore';
import { showPaymentToast } from '@/components/common/PaymentToast';
import { useReportConfirmStore } from '@/components/property/ReportConfirmModal';
import { toast } from 'sonner';

interface PdfExportState {
  addressId: number | null;
  persona: string | null;
  isGenerating: boolean;
  downloadUrl: string | null;
  shareUrl: string | null;
  error: string | null;
  /** Pending token for after confirm modal */
  _pendingToken: string | null;
  /**
   * Kick off the export flow. `preferredTier` decides which tier is preselected
   * in the review modal — pass 'full' when the user clicked a paid CTA so
   * they don't land on the free option and have to switch manually.
   */
  startExport: (addressId: number, token?: string | null, preferredTier?: 'quick' | 'full') => void;
  /** Internal: called after user confirms in the review modal */
  _doExport: (addressId: number, token?: string | null, reportTier?: 'quick' | 'full') => void;
}

export const usePdfExportStore = create<PdfExportState>((set, get) => ({
  addressId: null,
  persona: null,
  isGenerating: false,
  downloadUrl: null,
  shareUrl: null,
  error: null,
  _pendingToken: null,

  startExport: (addressId: number, token?: string | null, preferredTier?: 'quick' | 'full') => {
    const state = get();
    if (state.isGenerating) return;

    const gate = useDownloadGateStore.getState();
    const persona = usePersonaStore.getState().persona;

    // If we already have a hosted report for this address+persona, navigate to it
    if (state.addressId === addressId && state.persona === persona && state.shareUrl) {
      window.location.href = state.shareUrl;
      return;
    }

    // Signed-in users → ReportConfirmModal (choose Quick free or Full)
    if (gate.isAuthenticated) {
      // Close UpgradeModal if open to prevent overlap
      if (gate.showUpgradeModal) gate.setShowUpgradeModal(false);
      set({ _pendingToken: token ?? null });
      const hasFullCredits = (gate.credits?.fullCredits ?? 0) > 0 || gate.credits?.plan === 'pro';
      useReportConfirmStore.getState().show(
        addressId,
        (tier: 'quick' | 'full') => {
          if (tier === 'full' && !hasFullCredits) {
            // No credits for Full → show UpgradeModal to purchase
            gate.setShowUpgradeModal(true, 'default', {}, addressId, persona);
          } else {
            get()._doExport(addressId, get()._pendingToken, tier);
          }
        },
        preferredTier,
      );
      return;
    }

    // Not signed in.
    //   - preferredTier === 'full' → send to the purchase/guest-checkout flow
    //     (UpgradeModal). Serious buyers don't have to sign up first; a guest
    //     Stripe session converts straight to a hosted Full report, and the
    //     success page prompts account creation after payment.
    //   - preferredTier === 'quick' or unset → nudge the low-friction path:
    //     sign in (Google OAuth one-tap) and then auto-generate a free
    //     Quick Report on return. NextAuth's `signIn` round-trips the
    //     `callbackUrl` so we can come back to the same property page.
    if (preferredTier === 'full') {
      gate.setShowUpgradeModal(true, 'default', {}, addressId, persona);
      return;
    }
    // Stash the intent on the URL so we auto-kick the Quick export after
    // the OAuth round-trip lands back here.
    const here = typeof window !== 'undefined' ? new URL(window.location.href) : null;
    if (here) {
      here.searchParams.set('autoSave', String(addressId));
      // Lazy import to keep this store tree-shakable for non-browser paths
      import('next-auth/react').then(({ signIn }) => {
        signIn(undefined, { callbackUrl: here.toString() });
      });
    } else {
      gate.setShowUpgradeModal(true, 'default', {}, addressId, persona);
    }
  },

  _doExport: async (addressId: number, _token?: string | null, reportTier?: 'quick' | 'full') => {
    const state = get();
    if (state.isGenerating) return;

    const gate = useDownloadGateStore.getState();
    const persona = usePersonaStore.getState().persona;

    set({ addressId, persona, isGenerating: true, error: null, downloadUrl: null, _pendingToken: null });

    let generatingToastId: string | number | undefined;
    try {
      // Always fetch a fresh token — the pre-modal token may have expired
      let token = _token;
      try {
        const tokenRes = await fetch('/api/auth/token');
        if (tokenRes.ok) {
          const data = await tokenRes.json();
          if (data.token) token = data.token;
        }
      } catch { /* fall back to passed token */ }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Send promo header so backend can bypass credit check in dev mode
      if (gate.credits?.plan === 'promo') {
        headers['X-Promo'] = '1';
      }

      // Include budget calculator inputs for PDF
      const budgetEntry = useBudgetStore.getState().entries[addressId];
      const budgetPayload = budgetEntry?.hasInteracted
        ? { budget_inputs: { persona, ...(persona === 'buyer' ? budgetEntry.buyer : budgetEntry.renter) } }
        : {};

      // Include rent comparison + advisor inputs for personalised rent analysis in PDF
      const rentInput = useRentInputStore.getState();
      const rentPayload = rentInput.dwellingType
        ? {
            rent_inputs: {
              dwelling_type: rentInput.dwellingType,
              bedrooms: rentInput.bedrooms,
              weekly_rent: rentInput.weeklyRent,
              finish_tier: rentInput.finishTier,
              bathrooms: rentInput.bathrooms,
              has_parking: rentInput.hasParking,
              has_insulation: rentInput.notInsulated ? false : undefined,
              is_furnished: rentInput.isPartiallyFurnished ? undefined : rentInput.isFurnished,
              is_partially_furnished: rentInput.isPartiallyFurnished,
              has_outdoor_space: rentInput.hasOutdoorSpace,
              is_character_property: rentInput.isCharacterProperty,
              shared_kitchen: rentInput.sharedKitchen,
              utilities_included: rentInput.utilitiesIncluded,
            },
          }
        : {};

      // Include buyer advisor inputs for personalised price analysis in PDF
      const buyerInput = useBuyerInputStore.getState();
      const buyerPayload = persona === 'buyer'
        ? {
            buyer_inputs: {
              asking_price: buyerInput.askingPrice,
              bedrooms: buyerInput.bedrooms,
              finish_tier: buyerInput.finishTier,
              bathrooms: buyerInput.bathrooms,
              has_parking: buyerInput.hasParking,
            },
          }
        : {};

      const tier = reportTier || 'full';
      const res = await fetch(
        `/api/v1/property/${addressId}/export/pdf/start?persona=${persona}&report_tier=${tier}`,
        { method: 'POST', headers, body: JSON.stringify({ ...budgetPayload, ...rentPayload, ...buyerPayload }) },
      );
      if (!res.ok) {
        if (res.status === 401) {
          // Auth failed — if user has credits, it's a session issue, not a paywall issue
          if (gate.credits && gate.credits.plan !== 'free' && (gate.credits.creditsRemaining ?? 0) > 0) {
            toast.error('Session expired — please sign out and sign back in, then try again.', { duration: 8000 });
            set({ isGenerating: false, error: 'Session expired' });
          } else {
            gate.setShowUpgradeModal(true, 'default', {}, addressId, persona);
            set({ isGenerating: false });
          }
          return;
        }
        if (res.status === 403) {
          const body = await res.json().catch(() => ({ detail: 'Upgrade required' }));
          if (gate.credits && gate.credits.plan !== 'free' && (gate.credits.creditsRemaining ?? 0) > 0) {
            toast.error(`Unable to generate report: ${body.detail}. Try signing out and back in.`, { duration: 8000 });
            set({ isGenerating: false, error: body.detail });
          } else {
            gate.setShowUpgradeModal(true, 'default', {}, addressId, persona);
            set({ isGenerating: false, error: body.detail });
          }
          return;
        }
        if (res.status === 429) {
          throw new Error('Rate limit reached — please wait a few minutes and try again.');
        }
        throw new Error('Failed to start PDF generation');
      }

      const { job_id, download_url } = await res.json();

      // Show persistent generating toast — dismissed when report completes or fails
      generatingToastId = toast.loading('Generating your report...', {
        description: tier === 'full'
          ? 'This typically takes 15-30 seconds. We\'ll email you a link when it\'s ready.'
          : 'This typically takes 15-30 seconds.',
      });

      // Poll for completion (every 2s, up to 90 attempts = 3 min max)
      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 2000));

        const statusRes = await fetch(
          `/api/v1/property/${addressId}/export/pdf/status/${job_id}`,
        );
        if (statusRes.status === 429) continue; // rate limited — skip and retry
        if (!statusRes.ok) throw new Error('Failed to check PDF status');

        const status = await statusRes.json();

        if (status.status === 'completed') {
          // Record download for rate limiting + deduct credit
          const gateState = useDownloadGateStore.getState();
          if (gateState.credits?.plan === 'pro') {
            gateState.recordDownload();
          } else {
            gateState.deductCredit(tier);
          }
          set({ downloadUrl: download_url, shareUrl: status.share_url, isGenerating: false });
          // Dismiss the generating toast
          toast.dismiss(generatingToastId);
          // Show completion toast with link to the report
          const isFull = tier === 'full';
          toast.success('Your report is ready!', {
            description: isFull
              ? 'Also emailed to you. Available anytime in My Reports.'
              : 'Available anytime in My Reports.',
            duration: 15000,
            action: status.share_url ? {
              label: 'Open report →',
              onClick: () => { window.open(status.share_url, '_blank', 'noopener,noreferrer'); },
            } : {
              label: 'Go to My Reports →',
              onClick: () => { window.location.href = '/account'; },
            },
          });
          return;
        }

        if (status.status === 'failed') {
          throw new Error(status.error ?? 'PDF generation failed');
        }
      }

      throw new Error('PDF generation timed out — check My Reports shortly');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      set({ error: msg, isGenerating: false });
      console.error('PDF export failed:', err);
      toast.dismiss(generatingToastId);
      toast.error(msg, { duration: 8000 });
    }
  },
}));
