'use client';

import { Bookmark, MapPin, Download, Loader2, Eye, ExternalLink, FileCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { getRatingBin } from '@/lib/constants';
import { usePdfExport } from '@/hooks/usePdfExport';

import type { PropertyReport, RatingBin } from '@/lib/types';
import type { LiveRates } from '@/hooks/usePropertyRates';
import { usePersonaStore } from '@/stores/personaStore';

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

export function PropertySummaryCard({
  report,
  liveRates,
  ratesLoading,
}: {
  report: PropertyReport;
  liveRates?: LiveRates | null;
  ratesLoading?: boolean;
}) {
  const { address, property, scores, coverage, market } = report;
  const hasScore = Number.isFinite(scores?.overall);
  const bin = hasScore ? getRatingBin(scores.overall) : null;
  const persona = usePersonaStore((s) => s.persona);

  // Use live CV when available, fall back to DB value from report
  const liveCV = liveRates?.current_valuation?.capital_value;
  const effectiveCV = liveCV ?? property.capital_value;
  const cvIsLive = !!liveCV;

  const pdf = usePdfExport(address.address_id, persona);

  // Persona-specific headline metric
  const personaHeadline = (() => {
    if (persona === 'renter' && market.rent_assessment?.median) {
      return `Median rent: $${market.rent_assessment.median}/wk for this area`;
    }
    if (persona === 'buyer') {
      const parts: string[] = [];
      const isMulti = !!report.property_detection?.is_multi_unit;
      const units = report.property_detection?.unit_count ?? 1;
      const alreadyPerUnit = !!property.cv_is_per_unit || cvIsLive;
      const displayCv = (isMulti && effectiveCV && units > 1 && !alreadyPerUnit) ? Math.round(effectiveCV / units) : effectiveCV;
      if (displayCv) {
        const isEstimated = isMulti && units > 1 && !alreadyPerUnit;
        parts.push(`${isEstimated ? '~' : 'CV: '}$${(displayCv / 1000).toFixed(0)}k${isEstimated ? ' est.' : ''}`);
      }
      if (market.rent_assessment?.median && effectiveCV) {
        const annualRent = market.rent_assessment.median * 52;
        const grossYield = (annualRent / effectiveCV) * 100;
        parts.push(`Est. yield: ${grossYield.toFixed(1)}%`);
      }
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    return null;
  })();

  return (
    <Card className="rounded-xl card-elevated overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Address + actions */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-piq-primary" />
              <h2 className="text-lg font-bold leading-tight tracking-tight">
                {address.full_address}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {address.suburb}, {address.city}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0 items-center">
            {pdf.shareUrl ? (
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => window.open(pdf.shareUrl!, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-3.5 w-3.5" /> View Report
              </Button>
            ) : pdf.downloadUrl ? (
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => window.open(pdf.downloadUrl!, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-3.5 w-3.5" /> View Report
              </Button>
            ) : (
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
                  <><Download className="h-3.5 w-3.5" /> Get Report</>
                )}
              </Button>
            )}
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
        <div className="flex items-center gap-4 pt-1">
          {hasScore && bin ? (
            <>
              <div
                className="flex items-center justify-center w-16 h-16 rounded-2xl text-white font-bold text-xl ring-4 ring-opacity-20"
                style={{ backgroundColor: bin.color, '--tw-ring-color': bin.color } as React.CSSProperties}
              >
                {Math.round(scores.overall)}
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold">{bin.label} Risk</p>
                <Badge variant={ratingVariant(scores.rating)} className="mt-1">
                  Score: {Math.round(scores.overall)}/100
                </Badge>
                {coverage && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {coverage.available} of {coverage.total} data layers available
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Score pending</p>
          )}
        </div>

        {/* Property info — key-value pills */}
        {(effectiveCV || ratesLoading || property.land_area_sqm || property.building_area_sqm || property.title_ref) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {(effectiveCV || ratesLoading) && (() => {
              const isMulti = !!report.property_detection?.is_multi_unit;
              const units = report.property_detection?.unit_count ?? 1;
              const alreadyPerUnit = !!property.cv_is_per_unit || cvIsLive;
              const perUnit = (isMulti && effectiveCV && units > 1 && !alreadyPerUnit) ? Math.round(effectiveCV / units) : null;
              return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium">
                  {ratesLoading && !effectiveCV ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Checking live pricing…</span>
                    </>
                  ) : effectiveCV ? (
                    <>
                      {perUnit
                        ? <>{formatCurrency(perUnit)} <span className="text-muted-foreground ml-1">(est. per unit)</span></>
                        : <>CV {formatCurrency(effectiveCV)}{alreadyPerUnit && <span className="text-muted-foreground ml-1">(unit)</span>}</>}
                      {ratesLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      {cvIsLive && <span className="text-muted-foreground font-normal">live</span>}
                    </>
                  ) : null}
                </span>
              );
            })()}
            {property.land_area_sqm && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium">
                Land {property.land_area_sqm.toLocaleString()}m²
              </span>
            )}
            {property.building_area_sqm && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium">
                Building {property.building_area_sqm.toLocaleString()}m²
              </span>
            )}
            {property.title_ref && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium text-muted-foreground">
                Title: {property.title_ref}
              </span>
            )}
            {report.terrain?.elevation_m != null && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium">
                {report.terrain.elevation_m.toFixed(0)}m elevation
              </span>
            )}
            {report.terrain?.slope_category && report.terrain.slope_category !== 'unknown' && report.terrain.slope_category !== 'flat' && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                report.terrain.slope_category === 'extreme' || report.terrain.slope_category === 'very steep'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : report.terrain.slope_category === 'steep'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'bg-muted/60'
              }`}>
                {report.terrain.slope_category.charAt(0).toUpperCase() + report.terrain.slope_category.slice(1)} slope
              </span>
            )}
            {report.terrain?.wind_exposure && report.terrain.wind_exposure !== 'unknown' && report.terrain.wind_exposure !== 'moderate' && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                report.terrain.wind_exposure === 'very_exposed'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : report.terrain.wind_exposure === 'exposed'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}>
                {report.terrain.wind_exposure === 'very_exposed' ? 'Very exposed' :
                 report.terrain.wind_exposure === 'exposed' ? 'Wind exposed' : 'Wind sheltered'}
              </span>
            )}
            {report.terrain?.is_depression && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                Low point
              </span>
            )}
            {report.terrain?.nearest_waterway_m != null && report.terrain.nearest_waterway_m <= 100 && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                report.terrain.nearest_waterway_m <= 50
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              }`}>
                {report.terrain.nearest_waterway_name || 'Waterway'} {report.terrain.nearest_waterway_m}m
              </span>
            )}
            {report.event_history && report.event_history.extreme_weather_5yr >= 3 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                {report.event_history.extreme_weather_5yr} weather events (5yr)
              </span>
            )}
          </div>
        )}

        {/* Persona-specific headline */}
        {personaHeadline && (
          <p className="text-sm font-medium text-piq-primary pt-1">
            {personaHeadline}
          </p>
        )}
      </CardContent>

    </Card>
  );
}
