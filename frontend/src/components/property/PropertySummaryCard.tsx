'use client';

import { Bookmark, MapPin, Download, Loader2, Eye, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { getRatingBin } from '@/lib/constants';
import { usePdfExport } from '@/hooks/usePdfExport';
import { PdfReadyModal } from './PdfReadyModal';
import type { PropertyReport, RatingBin } from '@/lib/types';

function ratingVariant(rating: RatingBin) {
  const map: Record<RatingBin, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    'very-low': 'default',
    'low': 'default',
    'moderate': 'secondary',
    'high': 'destructive',
    'very-high': 'destructive',
  };
  return map[rating];
}

function StreetViewLink({ lat, lng }: { lat: number; lng: number }) {
  const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-sm text-piq-primary hover:underline"
    >
      <Eye className="h-4 w-4" />
      View on Street View
    </a>
  );
}

function TradeMeLink({ address }: { address: string }) {
  const url = `https://www.trademe.co.nz/a/property/search?search_string=${encodeURIComponent(address)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-sm text-piq-primary hover:underline"
    >
      <ExternalLink className="h-4 w-4" />
      View on Trade Me
    </a>
  );
}

export function PropertySummaryCard({ report }: { report: PropertyReport }) {
  const { address, property, scores, coverage } = report;
  const hasScore = Number.isFinite(scores?.overall);
  const bin = hasScore ? getRatingBin(scores.overall) : null;

  const pdf = usePdfExport(address.address_id);

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-3">
        {/* Address + actions */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-piq-primary" />
              <h2 className="text-lg font-semibold leading-tight">
                {address.full_address}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {address.suburb}, {address.city}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0 items-center">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
              onClick={pdf.startExport}
              disabled={pdf.isGenerating}
            >
              {pdf.isGenerating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
              ) : (
                <><Download className="h-3.5 w-3.5" /> Download PDF</>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Save property">
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* External links */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {address.lat && address.lng && (
            <StreetViewLink lat={address.lat} lng={address.lng} />
          )}
          <TradeMeLink address={address.full_address} />
        </div>

        {/* Score + metadata */}
        <div className="flex items-center gap-4">
          {hasScore && bin ? (
            <>
              <div
                className="flex items-center justify-center w-14 h-14 rounded-full text-white font-bold text-lg"
                style={{ backgroundColor: bin.color }}
              >
                {Math.round(scores.overall)}
              </div>
              <div className="flex-1">
                <Badge variant={ratingVariant(scores.rating)}>
                  {bin.label}
                </Badge>
                {coverage && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {coverage.available} of {coverage.total} data layers available
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Score pending</p>
          )}
        </div>

        {/* Property info */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {property.capital_value && (
            <span>CV: {formatCurrency(property.capital_value)}</span>
          )}
          {property.land_area_sqm && (
            <span>Land: {property.land_area_sqm.toLocaleString()}m²</span>
          )}
          {property.building_area_sqm && (
            <span>Building: {property.building_area_sqm.toLocaleString()}m²</span>
          )}
        </div>
      </CardContent>

      <PdfReadyModal
        show={pdf.showModal}
        isGenerating={pdf.isGenerating}
        downloadUrl={pdf.downloadUrl}
        error={pdf.error}
        onClose={pdf.closeModal}
      />
    </Card>
  );
}
