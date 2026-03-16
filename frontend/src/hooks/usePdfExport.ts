'use client';

import { useState, useCallback } from 'react';

interface PdfExportState {
  /** True while the PDF is being generated on the server */
  isGenerating: boolean;
  /** URL to open the completed report (set when ready) */
  downloadUrl: string | null;
  /** Error message if generation failed */
  error: string | null;
}

/**
 * Shared hook for PDF export.
 * Status is shown via the floating button — no toasts or modals.
 */
export function usePdfExport(addressId: number): PdfExportState & { startExport: () => void } {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startExport = useCallback(async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);

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
          setIsGenerating(false);
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
      setIsGenerating(false);
      console.error('PDF export failed:', err);
    }
  }, [addressId, isGenerating]);

  return { isGenerating, downloadUrl, error, startExport };
}
