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
  startExport: (addressId: number, token?: string | null) => void;
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

  startExport: (addressId: number, token?: string | null) => {
    const state = get();
    if (state.isGenerating) return;

    const gate = useDownloadGateStore.getState();
    const persona = usePersonaStore.getState().persona;

    // If we already have a hosted report for this address+persona, navigate to it
    if (state.addressId === addressId && state.persona === persona && state.shareUrl) {
      window.location.href = state.shareUrl;
      return;
    }

    // Pro users → straight to ReportConfirmModal (always Full, unlimited)
    if (gate.credits?.plan === 'pro') {
      set({ _pendingToken: token ?? null });
      useReportConfirmStore.getState().show(addressId, (tier: 'quick' | 'full') => {
        get()._doExport(addressId, get()._pendingToken, tier);
      });
      return;
    }

    // Signed-in users with credits → ReportConfirmModal (choose Quick free or Full with credit)
    if (gate.isAuthenticated && gate.credits && gate.credits.plan !== 'free' && (gate.credits.creditsRemaining ?? 0) > 0) {
      set({ _pendingToken: token ?? null });
      useReportConfirmStore.getState().show(addressId, (tier: 'quick' | 'full') => {
        get()._doExport(addressId, get()._pendingToken, tier);
      });
      return;
    }

    // Signed-in users without credits → generate free Quick Report directly
    if (gate.isAuthenticated) {
      set({ _pendingToken: token ?? null });
      useReportConfirmStore.getState().show(addressId, (tier: 'quick' | 'full') => {
        if (tier === 'full') {
          // Need to purchase — show UpgradeModal
          gate.setShowUpgradeModal(true, 'default', {}, addressId, persona);
        } else {
          get()._doExport(addressId, get()._pendingToken, 'quick');
        }
      });
      return;
    }

    // Not signed in → UpgradeModal (sign-in prompt + purchase options)
    gate.setShowUpgradeModal(true, 'default', {}, addressId, persona);
  },

  _doExport: async (addressId: number, _token?: string | null, reportTier?: 'quick' | 'full') => {
    const state = get();
    if (state.isGenerating) return;

    const gate = useDownloadGateStore.getState();
    const persona = usePersonaStore.getState().persona;

    set({ addressId, persona, isGenerating: true, error: null, downloadUrl: null, _pendingToken: null });

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

      // Show generating toast
      toast.info('Generating your report...', {
        description: 'This typically takes 15-30 seconds. We\'ll email you a link when it\'s ready, or find it in My Reports.',
        duration: 8000,
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
          // Show completion toast with link to My Reports
          toast.success('Your report is ready!', {
            description: 'We\'ll also email you a link. View it anytime from My Reports.',
            duration: 10000,
            action: {
              label: 'Go to My Reports',
              onClick: () => { window.location.href = '/account'; },
            },
          });
          return;
        }

        if (status.status === 'failed') {
          throw new Error(status.error ?? 'PDF generation failed');
        }
      }

      throw new Error('PDF generation timed out');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      set({ error: msg, isGenerating: false });
      console.error('PDF export failed:', err);
      toast.error(msg, { duration: 8000 });
    }
  },
}));
