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
  _doExport: (addressId: number, token?: string | null) => void;
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

    // --- Paywall gate ---
    const gate = useDownloadGateStore.getState();
    const persona = usePersonaStore.getState().persona;
    const { allowed } = gate.canDownload();
    if (!allowed) {
      gate.setShowUpgradeModal(true, 'default', {}, addressId, persona);
      return;
    }

    // If we already have a hosted report for this address+persona, open it
    if (state.addressId === addressId && state.persona === persona && (state.shareUrl || state.downloadUrl)) {
      window.open((state.shareUrl || state.downloadUrl)!, '_blank', 'noopener,noreferrer');
      return;
    }

    // Show confirmation modal — user reviews inputs before generating
    set({ _pendingToken: token ?? null });
    useReportConfirmStore.getState().show(addressId, () => {
      get()._doExport(addressId, get()._pendingToken);
    });
  },

  _doExport: async (addressId: number, _token?: string | null) => {
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

      const res = await fetch(
        `/api/v1/property/${addressId}/export/pdf/start?persona=${persona}`,
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
            showPaymentToast('report_generated');
          } else {
            const remaining = (gateState.credits?.creditsRemaining ?? 1) - 1;
            gateState.deductCredit();
            if (remaining <= 0) {
              showPaymentToast('last_credit');
            } else {
              showPaymentToast('report_generated', remaining);
            }
          }
          set({ downloadUrl: download_url, shareUrl: status.share_url, isGenerating: false });
          // Auto-open the hosted report
          if (status.share_url) {
            window.open(status.share_url, '_blank', 'noopener,noreferrer');
          }
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
