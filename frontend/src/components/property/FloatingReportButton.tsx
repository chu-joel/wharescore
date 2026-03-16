'use client';

import { createPortal } from 'react-dom';
import { Download, Loader2, FileCheck } from 'lucide-react';
import { usePdfExport } from '@/hooks/usePdfExport';
import { useEffect, useState } from 'react';

interface FloatingReportButtonProps {
  addressId: number;
}

export function FloatingReportButton({ addressId }: FloatingReportButtonProps) {
  const pdf = usePdfExport(addressId);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleClick = () => {
    if (pdf.downloadUrl) {
      // Report is ready — open it
      window.open(pdf.downloadUrl, '_blank', 'noopener,noreferrer');
    } else if (!pdf.isGenerating) {
      // Start generating
      pdf.startExport();
    }
  };

  return createPortal(
    <button
      onClick={handleClick}
      disabled={pdf.isGenerating}
      className="fixed bottom-5 left-5 z-[9999] flex items-center gap-2 rounded-full bg-piq-primary text-white pl-4 pr-5 py-3 shadow-lg shadow-piq-primary/25 hover:bg-piq-primary-dark transition-all duration-200 hover:shadow-xl hover:shadow-piq-primary/30 active:scale-95 disabled:opacity-80 disabled:cursor-wait"
      aria-label={pdf.isGenerating ? 'Generating report' : pdf.downloadUrl ? 'Open report' : 'Get full report'}
    >
      {pdf.isGenerating ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-semibold">Generating...</span>
        </>
      ) : pdf.downloadUrl ? (
        <>
          <FileCheck className="h-5 w-5" />
          <span className="text-sm font-semibold">Open Report</span>
        </>
      ) : (
        <>
          <Download className="h-5 w-5" />
          <span className="text-sm font-semibold">Get Full Report</span>
        </>
      )}
    </button>,
    document.body,
  );
}
