'use client';

import { useState, useEffect } from 'react';
import { MapPin, Download, Loader2, Eye, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { getRatingBin } from '@/lib/constants';
import { usePdfExport } from '@/hooks/usePdfExport';

import type { PropertyReport } from '@/lib/types';
import type { LiveRates } from '@/hooks/usePropertyRates';
import { usePersonaStore } from '@/stores/personaStore';

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
      <CardContent className="p-3 sm:p-5 space-y-3 sm:space-y-4">
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
            {(() => {
              const titleType = (report as unknown as Record<string, unknown>)?.property && ((report as unknown as Record<string, unknown>).property as Record<string, unknown>)?.title_type as string;
              const buildingUse = (report as unknown as Record<string, unknown>)?.property && ((report as unknown as Record<string, unknown>).property as Record<string, unknown>)?.building_use as string;
              const propType = (titleType && titleType !== 'Unknown' ? titleType : null) || (buildingUse && buildingUse !== 'Unknown' ? buildingUse : null);
              return propType ? (
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-piq-primary/10 text-piq-primary text-xs font-medium">
                  {String(propType)}
                </span>
              ) : null;
            })()}
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
                variant="default"
                size="sm"
                className="h-9 gap-1.5 text-sm font-semibold bg-piq-primary hover:bg-piq-primary-dark text-white"
                onClick={pdf.startExport}
                disabled={pdf.isGenerating}
              >
                {pdf.isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Download className="h-4 w-4" /> Get Your Report</>
                )}
              </Button>
            )}
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
                {coverage && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {coverage.available} of {coverage.total} risk checks available
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Score pending</p>
          )}
        </div>

        {/* Property info — key-value pills */}
        <PropertyPills report={report} property={property} effectiveCV={effectiveCV} cvIsLive={cvIsLive} ratesLoading={ratesLoading} />

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

function PropertyPills({ report, property, effectiveCV, cvIsLive, ratesLoading }: {
  report: PropertyReport;
  property: PropertyReport['property'];
  effectiveCV: number | null | undefined;
  cvIsLive: boolean;
  ratesLoading?: boolean;
}) {
  const [showAllPills, setShowAllPills] = useState(false);
  const [ratesTimedOut, setRatesTimedOut] = useState(false);

  useEffect(() => {
    if (!ratesLoading) { setRatesTimedOut(false); return; }
    const t = setTimeout(() => setRatesTimedOut(true), 15000);
    return () => clearTimeout(t);
  }, [ratesLoading]);

  if (!effectiveCV && !ratesLoading && !property.land_area_sqm && !property.building_area_sqm && !property.title_ref) return null;

  // Build all pills as an array of ReactNode
  const pills: React.ReactNode[] = [];

  if (effectiveCV || ratesLoading) {
    const isMulti = !!report.property_detection?.is_multi_unit;
    const units = report.property_detection?.unit_count ?? 1;
    const alreadyPerUnit = !!property.cv_is_per_unit || cvIsLive;
    const perUnit = (isMulti && effectiveCV && units > 1 && !alreadyPerUnit) ? Math.round(effectiveCV / units) : null;
    pills.push(
      <span key="cv" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium">
        {ratesLoading && !effectiveCV ? (
          ratesTimedOut ? (
            <span className="text-muted-foreground">Rates unavailable</span>
          ) : (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Checking live pricing...</span>
            </>
          )
        ) : effectiveCV ? (
          <>
            {perUnit
              ? <>{formatCurrency(perUnit)} <span className="text-muted-foreground ml-1">(est. per unit)</span></>
              : <>Valuation {formatCurrency(effectiveCV)}{alreadyPerUnit && <span className="text-muted-foreground ml-1">(unit)</span>}</>}
            {ratesLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {cvIsLive && <span className="text-muted-foreground font-normal">live</span>}
          </>
        ) : null}
      </span>
    );
  }
  if (property.land_area_sqm) {
    pills.push(
      <span key="land" className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium">
        Land {property.land_area_sqm.toLocaleString()}m²
      </span>
    );
  }
  if (property.building_area_sqm) {
    pills.push(
      <span key="building" className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium">
        Building {property.building_area_sqm.toLocaleString()}m²
      </span>
    );
  }
  if (property.title_ref) {
    pills.push(
      <span key="title" className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium text-muted-foreground">
        Title: {property.title_ref}
      </span>
    );
  }
  if (report.terrain?.elevation_m != null) {
    pills.push(
      <span key="elev" className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium">
        {report.terrain.elevation_m.toFixed(0)}m elevation
      </span>
    );
  }
  if (report.terrain?.slope_category && report.terrain.slope_category !== 'unknown' && report.terrain.slope_category !== 'flat') {
    pills.push(
      <span key="slope" className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
        report.terrain.slope_category === 'extreme' || report.terrain.slope_category === 'very steep'
          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          : report.terrain.slope_category === 'steep'
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
          : 'bg-muted/60'
      }`}>
        {report.terrain.slope_category.charAt(0).toUpperCase() + report.terrain.slope_category.slice(1)} slope
      </span>
    );
  }
  if (report.terrain?.wind_exposure && report.terrain.wind_exposure !== 'unknown' && report.terrain.wind_exposure !== 'moderate') {
    pills.push(
      <span key="wind" className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
        report.terrain.wind_exposure === 'very_exposed'
          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          : report.terrain.wind_exposure === 'exposed'
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      }`}>
        {report.terrain.wind_exposure === 'very_exposed' ? 'Very exposed' :
         report.terrain.wind_exposure === 'exposed' ? 'Wind exposed' : 'Wind sheltered'}
      </span>
    );
  }
  if (report.terrain?.is_depression) {
    pills.push(
      <span key="depression" className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
        Low point
      </span>
    );
  }
  if (report.terrain?.nearest_waterway_m != null && report.terrain.nearest_waterway_m <= 100) {
    pills.push(
      <span key="waterway" className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
        report.terrain.nearest_waterway_m <= 50
          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      }`}>
        {report.terrain.nearest_waterway_name || 'Waterway'} {report.terrain.nearest_waterway_m}m
      </span>
    );
  }
  if (report.event_history && report.event_history.extreme_weather_5yr >= 3) {
    pills.push(
      <span key="weather" className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
        {report.event_history.extreme_weather_5yr} weather events (5yr)
      </span>
    );
  }

  if (pills.length === 0) return null;

  const VISIBLE_COUNT = 3;
  const visiblePills = pills.slice(0, VISIBLE_COUNT);
  const hiddenPills = pills.slice(VISIBLE_COUNT);

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {visiblePills}
      {showAllPills && hiddenPills}
      {hiddenPills.length > 0 && (
        <button
          onClick={() => setShowAllPills(!showAllPills)}
          className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium text-piq-primary hover:bg-muted transition-colors"
        >
          {showAllPills ? 'Show less' : `Show ${hiddenPills.length} more`}
        </button>
      )}
    </div>
  );
}
