'use client';

import { AlertTriangle, CheckCircle2, Share2, Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCoverage } from '@/lib/format';
import { usePdfExport } from '@/hooks/usePdfExport';

import type { PropertyReport } from '@/lib/types';

interface KeyTakeawaysProps {
  report: PropertyReport;
  onSearchAnother: () => void;
}

export function KeyTakeaways({ report, onSearchAnother }: KeyTakeawaysProps) {
  const categories = Array.isArray(report.scores?.categories) ? report.scores.categories : [];
  const allIndicators = categories.flatMap((c) => c.indicators ?? []);
  const hasIndicators = allIndicators.some((i) => i.is_available);
  const concerns = allIndicators.filter((i) => i.is_available && i.score >= 60);
  const positives = allIndicators
    .filter((i) => i.is_available && i.score <= 20)
    .slice(0, 3);

  const pdf = usePdfExport(report.address.address_id);

  const handleShare = async () => {
    const url = window.location.href;
    const score = Number.isFinite(report.scores.overall) ? Math.round(report.scores.overall) : '—';
    const text = `WhareScore report for ${report.address.full_address} — Score: ${score}/100`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'WhareScore Report', text, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="space-y-3">
      {/* Concerns / Positives / Confidence — only when indicators exist */}
      {hasIndicators ? (
        <>
          {concerns.length > 0 ? (
            <div className="rounded-lg border-l-4 border-risk-very-high border border-border p-3">
              <p className="text-sm font-semibold mb-2">
                {concerns.length} {concerns.length === 1 ? 'thing' : 'things'} to investigate
              </p>
              <ul className="space-y-1.5">
                {concerns.map((indicator) => (
                  <li key={indicator.name} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-risk-very-high shrink-0 mt-0.5" />
                    <span>
                      <span className="font-medium">{indicator.name}:</span>{' '}
                      <span className="text-muted-foreground">{indicator.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border-l-4 border-piq-success border border-border p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-piq-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">No significant concerns identified</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Across {report.coverage?.available ?? allIndicators.length} indicators assessed, this property has a clean risk profile.
                  </p>
                </div>
              </div>
            </div>
          )}

          {positives.length > 0 && (
            <div className="rounded-lg border-l-4 border-piq-success border border-border p-3">
              <p className="text-sm font-semibold mb-2">
                {positives.length} {positives.length === 1 ? 'thing' : 'things'} that look good
              </p>
              <ul className="space-y-1.5">
                {positives.map((indicator) => (
                  <li key={indicator.name} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-piq-success shrink-0 mt-0.5" />
                    <span>
                      <span className="font-medium">{indicator.name}:</span>{' '}
                      <span className="text-muted-foreground">{indicator.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.coverage && (
            <p className="text-xs text-muted-foreground text-center">
              Confidence: {Math.round(report.coverage.percentage)}% ({formatCoverage(report.coverage.available, report.coverage.total)} indicators available)
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          Indicator analysis will appear here once scoring data is available.
        </p>
      )}

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={onSearchAnother} className="flex-1">
          Search Another Address
        </Button>
        <Button variant="outline" onClick={handleShare} className="flex-1">
          <Share2 className="h-4 w-4 mr-1.5" />
          Share
        </Button>
        <Button
          variant="outline"
          onClick={pdf.startExport}
          disabled={pdf.isGenerating}
          className="flex-1"
        >
          {pdf.isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Printer className="h-4 w-4 mr-1.5" />
              Export PDF
            </>
          )}
        </Button>
      </div>

    </div>
  );
}
