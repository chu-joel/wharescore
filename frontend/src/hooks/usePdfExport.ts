'use client';

import { useCallback } from 'react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { usePdfExportStore } from '@/stores/pdfExportStore';

/**
 * Shared hook for PDF export — all instances share the same Zustand store,
 * so generating from one button updates all buttons across the page.
 */
export function usePdfExport(addressId: number, persona?: string) {
  const isGenerating = usePdfExportStore((s) => s.isGenerating);
  const downloadUrl = usePdfExportStore((s) =>
    s.addressId === addressId && (!persona || s.persona === persona) ? s.downloadUrl : null
  );
  const shareUrl = usePdfExportStore((s) =>
    s.addressId === addressId && (!persona || s.persona === persona) ? s.shareUrl : null
  );
  const error = usePdfExportStore((s) =>
    s.addressId === addressId && (!persona || s.persona === persona) ? s.error : null
  );
  const _startExport = usePdfExportStore((s) => s.startExport);
  const { getToken } = useAuthToken();

  const startExport = useCallback(async () => {
    const token = await getToken();
    _startExport(addressId, token);
  }, [addressId, _startExport, getToken]);

  return { isGenerating, downloadUrl, shareUrl, error, startExport };
}
