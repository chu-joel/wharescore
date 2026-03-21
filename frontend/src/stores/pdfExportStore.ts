import { create } from 'zustand';
import { usePersonaStore } from './personaStore';
import { useDownloadGateStore } from './downloadGateStore';
import { useBudgetStore } from './budgetStore';
import { useRentInputStore } from './rentInputStore';
import { showPaymentToast } from '@/components/common/PaymentToast';

interface PdfExportState {
  addressId: number | null;
  persona: string | null;
  isGenerating: boolean;
  downloadUrl: string | null;
  error: string | null;
  startExport: (addressId: number, token?: string | null) => void;
}

export const usePdfExportStore = create<PdfExportState>((set, get) => ({
  addressId: null,
  persona: null,
  isGenerating: false,
  downloadUrl: null,
  error: null,

  startExport: async (addressId: number, token?: string | null) => {
    const state = get();
    if (state.isGenerating) return;

    // --- Paywall gate ---
    const gate = useDownloadGateStore.getState();
    const persona = usePersonaStore.getState().persona;
    const { allowed, reason } = gate.canDownload();
    if (!allowed) {
      // Show upgrade modal for any blocked reason — pass address context for guest checkout
      gate.setShowUpgradeModal(true, 'default', {}, addressId, persona);
      return;
    }

    // If we already have a download URL for this address+persona, just open it
    if (state.downloadUrl && state.addressId === addressId && state.persona === persona) {
      window.open(state.downloadUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    set({ addressId, persona, isGenerating: true, error: null, downloadUrl: null });

    try {
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
              is_furnished: rentInput.isFurnished,
              shared_kitchen: rentInput.sharedKitchen,
              utilities_included: rentInput.utilitiesIncluded,
            },
          }
        : {};

      const res = await fetch(
        `/api/v1/property/${addressId}/export/pdf/start?persona=${persona}`,
        { method: 'POST', headers, body: JSON.stringify({ ...budgetPayload, ...rentPayload }) },
      );
      if (!res.ok) {
        if (res.status === 401) {
          gate.setShowUpgradeModal(true);
          set({ isGenerating: false });
          return;
        }
        if (res.status === 403) {
          const body = await res.json().catch(() => ({ detail: 'Upgrade required' }));
          gate.setShowUpgradeModal(true);
          set({ isGenerating: false, error: body.detail });
          return;
        }
        if (res.status === 429) {
          throw new Error('Rate limit reached — please wait a few minutes and try again.');
        }
        throw new Error('Failed to start PDF generation');
      }

      const { job_id, download_url } = await res.json();

      // Poll for completion
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 1000));

        const statusRes = await fetch(
          `/api/v1/property/${addressId}/export/pdf/status/${job_id}`,
        );
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
          set({ downloadUrl: download_url, isGenerating: false });
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
    }
  },
}));
