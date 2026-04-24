'use client';

import { useState, useEffect } from 'react';
import { MapPin, Download, Loader2, Eye, ExternalLink, BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatCompactCurrency, resolveFloorArea } from '@/lib/format';
import { getRatingBin } from '@/lib/constants';
import { usePdfExport } from '@/hooks/usePdfExport';
import { useSession } from 'next-auth/react';

import type { PropertyReport } from '@/lib/types';
import type { LiveRates } from '@/hooks/usePropertyRates';
import { usePersonaStore } from '@/stores/personaStore';
import { EnterRentButton } from './EnterRentButton';

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
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';

  // Persona-specific headline metric
  const personaHeadline = (() => {
    if (persona === 'renter' && market.rent_assessment?.median) {
      // "For this area" was ambiguous. users asked "which area?". Name
      // the suburb when we have it so the median is grounded.
      const suburb = address.suburb || address.sa2_name || 'this area';
      return `Median rent: $${market.rent_assessment.median}/wk in ${suburb}`;
    }
    if (persona === 'buyer') {
      const parts: string[] = [];
      const isMulti = !!report.property_detection?.is_multi_unit;
      const units = report.property_detection?.unit_count ?? 1;
      // Match the same "looks building-level" heuristic used in PropertyPills
      // so the yield calc doesn't divide rent by an $80M CV and render 0.0%.
      const looksBuildingLevel = !!effectiveCV && isMulti && units > 1 && effectiveCV > 5_000_000;
      const alreadyPerUnit = (!!property.cv_is_per_unit || cvIsLive) && !looksBuildingLevel;
      const displayCv = (isMulti && effectiveCV && units > 1 && !alreadyPerUnit) ? Math.round(effectiveCV / units) : effectiveCV;
      if (displayCv) {
        const isEstimated = isMulti && units > 1 && !alreadyPerUnit;
        parts.push(`${isEstimated ? '~' : 'CV: '}${formatCompactCurrency(displayCv)}${isEstimated ? ' est.' : ''}`);
      }
      // Only show yield when we actually have a single-unit CV to divide
      // into. For building-total CVs we've already hidden/estimated the
      // number above. a "0.0% yield" line below it looks like real data.
      if (market.rent_assessment?.median && displayCv && !looksBuildingLevel) {
        const annualRent = market.rent_assessment.median * 52;
        const grossYield = (annualRent / displayCv) * 100;
        if (grossYield >= 0.5 && grossYield <= 20) {
          parts.push(`Est. yield: ${grossYield.toFixed(1)}%`);
        }
      }
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    return null;
  })();

  return (
    <Card className="rounded-xl card-elevated overflow-hidden">
      <CardContent className="p-3 sm:p-5 space-y-3 sm:space-y-4">
        {/* Address + actions. Stack on mobile so the address isn't
            crushed to three lines by the "Get Your Report" button. */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-piq-primary" />
              <h2 className="text-lg font-bold leading-tight tracking-tight break-words">
                {address.full_address}
              </h2>
            </div>
            {/* Only repeat suburb/city if the full_address doesn't already
                include them. LINZ addresses usually end with both, so this
                line is suppressed for most properties. */}
            {(() => {
              const full = (address.full_address || '').toLowerCase();
              const suburb = (address.suburb || '').toLowerCase();
              const city = (address.city || '').toLowerCase();
              const hasSuburb = suburb && full.includes(suburb);
              const hasCity = city && full.includes(city);
              if (hasSuburb && hasCity) return null;
              const missing = [!hasSuburb ? address.suburb : null, !hasCity ? address.city : null].filter(Boolean).join(', ');
              return missing ? (
                <p className="text-sm text-muted-foreground mt-0.5">{missing}</p>
              ) : null;
            })()}
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
          <div className="flex gap-1.5 shrink-0 items-center w-full sm:w-auto">
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
              // The header CTA mirrors the ReportCTABanner intent: unauth
              // users get the low-friction "Save free report" primary (which
              // kicks a Google sign-in, then auto-generates Quick on return);
              // signed-in users see "Generate Report" and pick Quick/Full in
              // the confirm modal.
              <Button
                variant="default"
                size="sm"
                className="h-9 gap-1.5 text-sm font-semibold bg-piq-primary hover:bg-piq-primary-dark text-white"
                onClick={() => pdf.startExport(isAuthenticated ? undefined : 'quick')}
                disabled={pdf.isGenerating}
              >
                {pdf.isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {isAuthenticated ? 'Generating…' : 'Saving…'}</>
                ) : isAuthenticated ? (
                  <><Download className="h-4 w-4" /> Generate Report</>
                ) : (
                  <><BookmarkPlus className="h-4 w-4" /> Save free report</>
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

        {/* Score + metadata. The EnterRentButton on the right is
            renter-only and jumps to the rent section. We keep it here
            (rather than a floating top-bar button) so it lives right
            next to the score — users scanning the summary see "your
            risk is X, and here's the one action you probably want to
            take" in a single glance. */}
        <div className="flex items-center gap-4 pt-1">
          {hasScore && bin ? (
            <>
              <div
                className="flex items-center justify-center w-16 h-16 rounded-2xl text-white font-bold text-xl ring-4 ring-opacity-20 shrink-0"
                style={{ backgroundColor: bin.color, '--tw-ring-color': bin.color } as React.CSSProperties}
              >
                {Math.round(scores.overall)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold">{bin.label} Risk</p>
                {coverage && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {coverage.available + (coverage.bonus_features?.length ?? 0)} risk checks completed
                  </p>
                )}
              </div>
              <EnterRentButton />
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground flex-1">Score pending</p>
              <EnterRentButton />
            </>
          )}
        </div>

        {/* Property info. key-value pills */}
        <PropertyPills report={report} property={property} liveRates={liveRates} effectiveCV={effectiveCV} cvIsLive={cvIsLive} ratesLoading={ratesLoading} />

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

function PropertyPills({ report, property, liveRates, effectiveCV, cvIsLive, ratesLoading }: {
  report: PropertyReport;
  property: PropertyReport['property'];
  liveRates?: LiveRates | null;
  effectiveCV: number | null | undefined;
  cvIsLive: boolean;
  ratesLoading?: boolean;
}) {
  // Overlay per-unit floor area / coverage from the live rates response
  // (AKCC / WDC / ICC). `_fix_unit_cv` doesn't run on the cached /report
  // path any more, so `property.floor_area_sqm` is null until the lazy
  // /rates call resolves - merge here.
  const effectiveProperty: typeof property = {
    ...property,
    floor_area_sqm: liveRates?.total_floor_area_sqm ?? property.floor_area_sqm,
    floor_area_source: liveRates?.source ?? property.floor_area_source,
    site_coverage_sqm: liveRates?.building_site_coverage_pct ?? property.site_coverage_sqm,
  };
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
    // Don't trust a "per-unit" claim from the backend if the value itself
    // looks building-level (e.g. a $80M "unit"). Anything over $5M on a
    // multi-unit address almost certainly represents the whole building.
    const looksBuildingLevel =
      !!effectiveCV && isMulti && units > 1 && effectiveCV > 5_000_000;
    const alreadyPerUnit = (!!property.cv_is_per_unit || cvIsLive) && !looksBuildingLevel;
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
            {cvIsLive && !looksBuildingLevel && <span className="text-muted-foreground font-normal">live</span>}
          </>
        ) : null}
      </span>
    );
  }
  // In a multi-unit building the land and building areas apply to the
  // whole block, not the individual apartment. Showing "Land 843 m²" for
  // a single unit is misleading, so we hide those pills in that case.
  const hideBuildingAreas =
    !!report.property_detection?.is_multi_unit &&
    (report.property_detection?.unit_count ?? 1) > 1;
  if (property.land_area_sqm && !hideBuildingAreas) {
    pills.push(
      <span key="land" className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium">
        Land {property.land_area_sqm.toLocaleString()}m²
      </span>
    );
  }
  if (!hideBuildingAreas) {
    const floor = resolveFloorArea(effectiveProperty, {
      isMultiUnit: !!report.property_detection?.is_multi_unit,
      titleType: property.title_type,
    });
    if (floor) {
      pills.push(
        <span key="building" className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium">
          {floor.label} {floor.value.toLocaleString()}m²
        </span>
      );
    }
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
          {showAllPills ? 'Show less' : `Show ${hiddenPills.length} more ${hiddenPills.length === 1 ? 'detail' : 'details'}`}
        </button>
      )}
    </div>
  );
}
