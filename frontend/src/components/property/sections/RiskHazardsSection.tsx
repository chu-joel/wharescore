'use client';

import { AlertTriangle, MapPin, Shield, Skull, Waves } from 'lucide-react';
import { IndicatorCard } from '@/components/common/IndicatorCard';
import { EmptyState } from '@/components/common/EmptyState';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import { EarthquakeDetailCard } from '@/components/property/EarthquakeDetailCard';
import { CoastalExposureCard } from '@/components/property/CoastalExposureCard';
import type { CategoryScore, HazardData, EnvironmentData } from '@/lib/types';
import type { CoastalExposure } from '@/components/report/HostedCoastalTimeline';
import { SolarPotentialCard } from '@/components/property/SolarPotentialCard';
import { ClimateForecastCard } from '@/components/property/ClimateForecastCard';

interface RiskHazardsSectionProps {
  category: CategoryScore;
  hazards?: HazardData;
  environment?: EnvironmentData;
  persona?: 'renter' | 'buyer';
  coastal?: CoastalExposure | null;
}

export function RiskHazardsSection({ category, hazards, environment, persona, coastal }: RiskHazardsSectionProps) {
  // Crime has its own dedicated CrimeCard inside the NeighbourhoodSection. suppress
  // the short "Crime. Higher than average" indicator here so the same information
  // doesn't show up twice on the same report.
  const available = category.indicators.filter(
    (i) => i.is_available && !i.name.toLowerCase().includes('crime'),
  );
  const critical = available.filter((i) => i.score >= 60);
  const normal = available.filter((i) => i.score < 60);
  const unavailable = category.indicators.filter(
    (i) => !i.is_available && !i.name.toLowerCase().includes('crime'),
  );
  const isRenter = persona === 'renter';

  if (available.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title="No hazard data available"
        description="Hazard data is not yet available for this location."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Coastal exposure (SeaRise-backed). Both personas; renter is further
          limited inside the card to happens_now only. */}
      {coastal && <CoastalExposureCard coastal={coastal} persona={persona} />}

      {/* Technical earthquake/fault details. buyers only */}
      {!isRenter && hazards && <EarthquakeDetailCard hazards={hazards} />}
      {!isRenter && hazards?.active_fault_nearest && (
        <ActiveFaultDetailCard fault={hazards.active_fault_nearest} />
      )}

      {/* Fault avoidance zone warning. show for both (it's actionable) */}
      {hazards?.fault_avoidance_zone && (
        <FaultAvoidanceZoneCard zone={hazards.fault_avoidance_zone} />
      )}

      {/* Critical findings first */}
      {critical.length > 0 && (
        <div className="space-y-2">
          {critical.map((indicator) => (
            <div
              key={indicator.name}
              className="border-l-[5px] border-risk-very-high rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3.5 flex items-start gap-2.5 shadow-sm shadow-red-200 dark:shadow-red-900/50"
            >
              {indicator.score >= 80 && (
                <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
              <AlertTriangle className="h-4 w-4 text-risk-very-high shrink-0 mt-0.5" />
              <div className="flex-1">
                <IndicatorCard indicator={indicator} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Normal indicators. show for buyers, simplified summary for renters */}
      {normal.length > 0 && (
        <>
          {critical.length === 0 && (
            <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 p-3">
              <EmptyState
                variant="no-risk"
                title="No significant hazard risks detected"
                description={`${available.length} hazard indicators assessed for this location.`}
              />
            </div>
          )}
          {isRenter ? (
            // Renters: just a summary count, not the full grid
            critical.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {normal.length} other hazard{normal.length !== 1 ? 's' : ''} checked. all within normal range.
              </p>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {normal.map((indicator) => (
                <IndicatorCard key={indicator.name} indicator={indicator} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Contaminated land. both personas (actionable) */}
      {hazards && hazards.contamination_count != null && hazards.contamination_count > 0 && (
        <ContaminatedLandCard hazards={hazards} />
      )}

      {/* Landslide detail. buyers only (too technical for renters) */}
      {!isRenter && hazards?.landslide_nearest && (
        <LandslideDetailCard landslide={hazards.landslide_nearest} count={hazards.landslide_count_500m} />
      )}

      {/* Climate projections. buyers only */}
      {!isRenter && environment?.climate_temp_change != null && (
        <ClimateForecastCard projection={{ temp_change: environment.climate_temp_change, precip_change_pct: environment.climate_precip_change_pct }} />
      )}

      {/* Solar potential. buyers only */}
      {!isRenter && hazards && (
        <SolarPotentialCard meanKwh={hazards.solar_mean_kwh} maxKwh={hazards.solar_max_kwh} />
      )}

      {/* Unavailable indicators. buyers only */}
      {!isRenter && unavailable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {unavailable.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      <DataSourceBadge source="Regional Councils, GNS, NIWA, Waka Kotahi, MfE" />
    </div>
  );
}

/** Active Fault nearest. shows what SQL actually delivers: name, distance, type, slip rate.
 * Earlier version had rows for fault.class / fault.fault_type / fault.recurrence_interval which
 * the SQL never provides. they always rendered as empty rows. Removed to keep the card clean.
 */
function ActiveFaultDetailCard({ fault }: {
  fault: NonNullable<HazardData['active_fault_nearest']>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30">
          <MapPin className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        </div>
        <span className="text-sm font-bold">Nearest Active Fault</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Fault name</span>
          <span className="font-medium text-right max-w-[60%] truncate">{fault.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Distance</span>
          <span className="font-semibold tabular-nums">
            {fault.distance_m < 1000
              ? `${Math.round(fault.distance_m)}m`
              : `${(fault.distance_m / 1000).toFixed(1)}km`}
          </span>
        </div>
        {fault.type && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fault class</span>
            <span className="font-medium">Class {fault.type}</span>
          </div>
        )}
        {fault.slip_rate_mm_yr != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Slip rate</span>
            <span className="font-semibold tabular-nums">{fault.slip_rate_mm_yr} mm/yr</span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2.5">Source: GNS Active Faults Database</p>
    </div>
  );
}

/** Fault Avoidance Zone. building restriction warning */
function FaultAvoidanceZoneCard({ zone }: {
  zone: NonNullable<HazardData['fault_avoidance_zone']>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30 p-3.5">
      <Shield className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
          Fault Avoidance Zone
        </p>
        <p className="text-xs text-orange-700 dark:text-orange-400">
          {zone.fault_name}. {zone.zone_type} zone (Class {zone.fault_class}).
          Building setback of {zone.setback_m}m may be required. Resource consent likely needed for new builds.
        </p>
      </div>
    </div>
  );
}

/** Contaminated Land detail. nearest site name, category, distance */
function ContaminatedLandCard({ hazards }: { hazards: HazardData }) {
  // Only show the detail card if we have specific contamination info beyond just count
  // The count is already shown in PlanningSection checklist, so here we show extra detail
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
          <Skull className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
        </div>
        <span className="text-sm font-bold">Contaminated Sites</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Sites nearby</span>
          <span className="font-semibold tabular-nums">{hazards.contamination_count}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2.5">
        Check the regional council&apos;s Selected Land Use Register (SLUR) for categories and restrictions.
      </p>
    </div>
  );
}

/** Landslide nearest. shows nearest recorded event details */
function LandslideDetailCard({ landslide, count }: {
  landslide: NonNullable<HazardData['landslide_nearest']>;
  count: number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <Waves className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        </div>
        <span className="text-sm font-bold">Nearest Recorded Landslide</span>
      </div>
      <div className="space-y-1.5">
        {landslide.name && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium text-right max-w-[60%] truncate">{landslide.name}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Distance</span>
          <span className="font-semibold tabular-nums">{Math.round(landslide.distance_m)}m</span>
        </div>
        {landslide.trigger && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Trigger</span>
            <span className="font-medium">{landslide.trigger}</span>
          </div>
        )}
        {landslide.movement_type && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Type</span>
            <span className="font-medium">{landslide.movement_type}</span>
          </div>
        )}
        {landslide.severity && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Severity</span>
            <span className="font-medium">{landslide.severity}</span>
          </div>
        )}
        {landslide.date && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{landslide.date}</span>
          </div>
        )}
        {landslide.damage && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Damage</span>
            <span className="font-medium text-right max-w-[60%]">{landslide.damage}</span>
          </div>
        )}
        {count != null && count > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total within 500m</span>
            <span className="font-semibold tabular-nums">{count}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2.5">Source: GNS NZ Landslide Database</p>
    </div>
  );
}
