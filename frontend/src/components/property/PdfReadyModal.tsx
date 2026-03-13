'use client';

import { CheckCircle2, Download, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PdfReadyModalProps {
  show: boolean;
  isGenerating: boolean;
  downloadUrl: string | null;
  error: string | null;
  onClose: () => void;
}

/**
 * Modal shown when PDF generation completes (or fails).
 *
 * The "Open Report" button is an <a> tag clicked by the user,
 * which counts as a trusted gesture on iOS Safari — no popup blocker.
 */
export function PdfReadyModal({ show, isGenerating, downloadUrl, error, onClose }: PdfReadyModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Property Report</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isGenerating ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Generating your comprehensive property report...
            </p>
            <p className="text-center text-xs text-muted-foreground">
              This typically takes 15-30 seconds
            </p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        ) : downloadUrl ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-200">Report is ready!</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Tap the button below to view and print your report.
            </p>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Open Report
              </Button>
            </a>
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
