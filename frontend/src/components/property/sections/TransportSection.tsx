'use client';

import { IndicatorCard } from '@/components/common/IndicatorCard';
import { EmptyState } from '@/components/common/EmptyState';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import { formatDistance } from '@/lib/format';
import { Building2, TrainFront, Bus, Ship, CableCar, Clock, Plane, Cross, GraduationCap, MapPin } from 'lucide-react';
import type { CategoryScore, LiveabilityData, TransitTravelTime } from '@/lib/types';
import { PremiumGate } from '../PremiumGate';

interface TransportSectionProps {
  category: CategoryScore;
  liveability: LiveabilityData;
  walkingReach?: {
    minutes: number;
    method: string;
    total_stops: number;
    bus_stops: number;
    rail_stops: number;
    ferry_stops: number;
  };
  elevation?: number | null;
  persona?: 'renter' | 'buyer';
}

export function TransportSection({ category, liveability, walkingReach, elevation, persona }: TransportSectionProps) {
  const available = category.indicators.filter((i) => i.is_available);
  const unavailable = category.indicators.filter((i) => !i.is_available);
  const isRenter = persona === 'renter';

  const cbdDistance = liveability.cbd_distance_m;
  const trainDistance = liveability.nearest_train_m;

  return (
    <div className="space-y-3">
      {/* Distance cards */}
      {(cbdDistance || trainDistance) && (
        <div className="grid grid-cols-2 gap-2.5">
          {cbdDistance != null && (
            <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-900/30 shrink-0">
                  <Building2 className="h-4 w-4 text-piq-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">To CBD</p>
                  <p className="text-base font-bold tabular-nums">{formatDistance(cbdDistance)}</p>
                </div>
              </div>
            </div>
          )}
          {trainDistance != null && (
            <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-900/30 shrink-0">
                  <TrainFront className="h-4 w-4 text-piq-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nearest train</p>
                  <p className="text-base font-bold tabular-nums">{formatDistance(trainDistance)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Walking reach (10-min walk via Valhalla) — preferred over 800m radius */}
      {walkingReach && walkingReach.method !== 'none' && walkingReach.total_stops > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4 card-elevated">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              Transit stops within 10-min walk
            </p>
            {walkingReach.method === 'valhalla' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-piq-primary/10 text-piq-primary">
                Hill-adjusted
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {walkingReach.bus_stops > 0 && (
              <div className="flex items-center gap-2">
                <Bus className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold tabular-nums">{walkingReach.bus_stops}</p>
                  <p className="text-xs text-muted-foreground">Bus</p>
                </div>
              </div>
            )}
            {walkingReach.rail_stops > 0 && (
              <div className="flex items-center gap-2">
                <TrainFront className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold tabular-nums">{walkingReach.rail_stops}</p>
                  <p className="text-xs text-muted-foreground">Rail</p>
                </div>
              </div>
            )}
            {walkingReach.ferry_stops > 0 && (
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold tabular-nums">{walkingReach.ferry_stops}</p>
                  <p className="text-xs text-muted-foreground">Ferry</p>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Based on actual walking routes{walkingReach.method === 'valhalla' ? ' with hill penalties' : ''}, not straight-line distance.
          </p>
        </div>
      ) : (liveability.bus_stops_800m != null || liveability.rail_stops_800m != null ||
        liveability.ferry_stops_800m != null || liveability.cable_car_stops_800m != null) ? (
        <div className="rounded-xl border border-border bg-card p-4 card-elevated">
          <p className="text-xs font-medium text-muted-foreground mb-2.5">Transit stops within 800m</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {liveability.bus_stops_800m != null && liveability.bus_stops_800m > 0 && (
              <div className="flex items-center gap-2">
                <Bus className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold tabular-nums">{liveability.bus_stops_800m}</p>
                  <p className="text-xs text-muted-foreground">
                    {liveability.bus_stops_800m === 1 ? 'Bus stop' : 'Bus stops'}
                  </p>
                </div>
              </div>
            )}
            {liveability.rail_stops_800m != null && liveability.rail_stops_800m > 0 && (
              <div className="flex items-center gap-2">
                <TrainFront className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold tabular-nums">{liveability.rail_stops_800m}</p>
                  <p className="text-xs text-muted-foreground">
                    {liveability.rail_stops_800m === 1 ? 'Train station' : 'Train stations'}
                  </p>
                </div>
              </div>
            )}
            {liveability.ferry_stops_800m != null && liveability.ferry_stops_800m > 0 && (
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold tabular-nums">{liveability.ferry_stops_800m}</p>
                  <p className="text-xs text-muted-foreground">
                    {liveability.ferry_stops_800m === 1 ? 'Ferry terminal' : 'Ferry terminals'}
                  </p>
                </div>
              </div>
            )}
            {liveability.cable_car_stops_800m != null && liveability.cable_car_stops_800m > 0 && (
              <div className="flex items-center gap-2">
                <CableCar className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold tabular-nums">{liveability.cable_car_stops_800m}</p>
                  <p className="text-xs text-muted-foreground">
                    {liveability.cable_car_stops_800m === 1 ? 'Cable-car stop' : 'Cable-car stops'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Transit travel times — top 3 AM free, rest gated */}
      {liveability.transit_travel_times && liveability.transit_travel_times.length > 0 && (() => {
        const FREE_ROUTES = 3;
        const amTimes = liveability.transit_travel_times;
        const freeTimes = amTimes.slice(0, FREE_ROUTES);
        const hiddenCount = amTimes.length - FREE_ROUTES;
        const hasPm = liveability.transit_travel_times_pm && liveability.transit_travel_times_pm.length > 0;

        return (
          <div className="space-y-2">
            <div className="rounded-xl border border-border bg-card p-4 card-elevated">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-piq-primary" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Peak commute times
                  </p>
                </div>
                {liveability.peak_trips_per_hour != null && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {Math.round(liveability.peak_trips_per_hour)} services/hr at peak
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {freeTimes.map((tt: TransitTravelTime) => (
                  <TravelTimeRow key={tt.destination} tt={tt} />
                ))}
              </div>
              {liveability.nearest_stop_name && (
                <p className="text-xs text-muted-foreground mt-2.5">
                  From nearest stop: {liveability.nearest_stop_name}
                </p>
              )}
            </div>

            {/* Gated: all remaining routes + PM peak */}
            {(hiddenCount > 0 || hasPm) && (
              <PremiumGate
                label={`All ${amTimes.length} destinations${hasPm ? ' + evening peak' : ''}`}
                trigger="default"
              >
                <div className="rounded-xl border border-border bg-card p-4 card-elevated space-y-1.5">
                  {amTimes.slice(FREE_ROUTES).map((tt: TransitTravelTime) => (
                    <TravelTimeRow key={tt.destination} tt={tt} />
                  ))}
                </div>
                {hasPm && (
                  <div className="rounded-xl border border-border bg-card p-4 card-elevated mt-2 space-y-1.5">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <p className="text-xs font-medium text-muted-foreground">Evening peak (4:30–6:30 PM)</p>
                    </div>
                    {liveability.transit_travel_times_pm!.map((tt: TransitTravelTime) => (
                      <TravelTimeRow key={tt.destination} tt={tt} />
                    ))}
                  </div>
                )}
              </PremiumGate>
            )}
          </div>
        );
      })()}

      {/* Indicator cards grid — buyers see full detail, renters see distance/commute cards above */}
      {!isRenter && available.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {available.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      ) : !isRenter && available.length === 0 ? (
        <EmptyState
          variant="no-data"
          title="No transport data available"
          description="Transport indicators are not available for this location."
        />
      ) : null}

      {!isRenter && unavailable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {unavailable.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      <DataSourceBadge source="Metlink GTFS, Waka Kotahi CAS" />
    </div>
  );
}

const DEST_ICONS: Record<string, typeof MapPin> = {
  'Wellington CBD': Building2,
  'Airport': Plane,
  'Hospital': Cross,
  'Victoria University': GraduationCap,
};

function TravelTimeRow({ tt }: { tt: TransitTravelTime }) {
  const Icon = DEST_ICONS[tt.destination] ?? MapPin;
  const minutes = Math.round(tt.minutes);
  const routeLabel = tt.routes?.[0]?.replace(/\s*\(bus\)$/i, '') ?? '';

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{tt.destination}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {routeLabel && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded max-w-[72px] truncate">
            {routeLabel}
          </span>
        )}
        <span className="text-sm font-bold tabular-nums min-w-[56px] text-right">
          {minutes} min
        </span>
      </div>
    </div>
  );
}
