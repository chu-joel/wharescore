'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface PdfExportState {
  /** True while the PDF is being generated on the server */
  isGenerating: boolean;
  /** URL to open the completed report (set when ready) */
  downloadUrl: string | null;
  /** True when the modal with the download link should show */
  showModal: boolean;
  /** Error message if generation failed */
  error: string | null;
  /** Close the modal and reset download state */
  closeModal: () => void;
}

/**
 * Shared hook for PDF export across all components.
 *
 * Generates in the background, shows a toast while loading,
 * then pops a modal with a download button when ready.
 * The user taps the button — a real user gesture — so
 * window.open / <a target="_blank"> works on iOS Safari.
 */
export function usePdfExport(addressId: number): PdfExportState & { startExport: () => void } {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setDownloadUrl(null);
    setError(null);
  }, []);

  const startExport = useCallback(async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);

    const toastId = toast.loading('Generating your report...');

    try {
      const res = await fetch(
        `/api/v1/property/${addressId}/export/pdf/start`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error('Failed to start PDF generation');

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
          setDownloadUrl(download_url);
          setShowModal(true);
          setIsGenerating(false);
          toast.success('Your report is ready!', { id: toastId });
          return;
        }

        if (status.status === 'failed') {
          throw new Error(status.error ?? 'PDF generation failed');
        }
      }

      throw new Error('PDF generation timed out');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setShowModal(true);
      setIsGenerating(false);
      toast.error('Report generation failed', { id: toastId });
      console.error('PDF export failed:', err);
    }
  }, [addressId, isGenerating]);

  return { isGenerating, downloadUrl, showModal, error, closeModal, startExport };
}
