'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getRatingBin } from '@/lib/constants';
import { formatScore, formatRent } from '@/lib/format';
import { ArrowRight, Building2, MapPin, Eye } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import type { PropertySummary } from '@/lib/types';

interface MapPopupProps {
  addressId: number;
  onViewReport: (addressId: number) => void;
  onClose: () => void;
  /** Overlay layer info collected at the tap/click point (flood zone, school zone, etc.) */
  overlayLines?: string[];
  /** Override the CTA button text (default: "Get the Full Report") */
  ctaLabel?: string;
}

export function MapPopup({ addressId, onViewReport, onClose, overlayLines, ctaLabel }: MapPopupProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['property-summary', addressId],
    queryFn: () => apiFetch<PropertySummary>(`/api/v1/property/${addressId}/summary`),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <p className="text-sm">No data available for this address</p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-piq-primary mt-2 hover:underline"
        >
          Close
        </button>
      </div>
    );
  }

  const bin = summary.scores ? getRatingBin(summary.scores.composite) : null;
  const selectedAddress = useSearchStore.getState().selectedAddress;

  // Build Google Street View URL using the selected address coordinates
  const lat = selectedAddress?.lat ?? 0;
  const lng = selectedAddress?.lng ?? 0;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  return (
    <div>
      {/* Header with score circle and address */}
      <div className="p-4 pb-3">
        <div className="flex gap-3 items-start">
          {/* Score circle */}
          {bin && summary.scores ? (
            <div
              className="flex items-center justify-center w-12 h-12 rounded-full text-white text-sm font-bold shrink-0 shadow-sm"
              style={{ backgroundColor: bin.color }}
              aria-label={`Risk score: ${formatScore(summary.scores.composite)} out of 100, ${bin.label}`}
            >
              {formatScore(summary.scores.composite)}
            </div>
          ) : (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground text-xs shrink-0">
              —
            </div>
          )}

          {/* Address and meta */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight break-words">
              {summary.full_address}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {bin && (
                <Badge
                  className="text-xs text-white px-1.5 py-0"
                  style={{ backgroundColor: bin.color }}
                >
                  {bin.label}
                </Badge>
              )}
              {summary.median_rent && (
                <span className="text-xs text-muted-foreground">
                  ~{formatRent(summary.median_rent)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CTA — above the fold, primary action */}
      <div className="px-4 pb-3">
        <Button
          className="w-full h-auto px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-1.5 flex-wrap"
          onClick={() => onViewReport(addressId)}
        >
          {ctaLabel ?? 'Get the Full Report'}
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-1.5">
          Risk · Rent · 40+ risk checks · AI summary
        </p>
      </div>

      {/* Notable findings — teasers that reinforce clicking */}
      {summary.notable_findings && summary.notable_findings.length > 0 && (
        <div className="px-4 pb-3">
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {summary.notable_findings.slice(0, 3).map((finding, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-piq-accent-warm mt-0.5">&#8226;</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Overlay context — visible layers at this location (replaces hover tooltip on touch) */}
      {overlayLines && overlayLines.length > 0 && (
        <div className="px-4 pb-3">
          <ul className="text-xs text-muted-foreground space-y-0.5 bg-muted/40 rounded-md px-2.5 py-1.5">
            {overlayLines.slice(0, 5).map((line, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-piq-primary mt-0.5">&#9679;</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Multi-unit indicator */}
      {summary.unit_count && summary.unit_count > 1 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
            <Building2 className="h-3 w-3" />
            <span>{summary.unit_count} units at this address</span>
          </div>
        </div>
      )}

      {/* Street View link */}
      <div className="px-4 pb-3 flex justify-end">
        <a
          href={streetViewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          aria-label="Open in Google Street View"
        >
          <Eye className="h-3 w-3" /> Street View
        </a>
      </div>
    </div>
  );
}
