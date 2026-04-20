'use client';

import {
  Mountain,
  ArrowUp,
  Sun,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  Compass,
  TrendingDown,
  Footprints,
  Bus,
  TrainFront,
  Ship,
  Wind,
  Droplets,
} from 'lucide-react';
import { useState } from 'react';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
}

/* ── slope bar segments ── */
const SLOPE_SEGMENTS = [
  { max: 2, label: 'Flat', color: 'bg-green-500' },
  { max: 5, label: 'Gentle', color: 'bg-emerald-400' },
  { max: 10, label: 'Moderate', color: 'bg-yellow-400' },
  { max: 15, label: 'Steep', color: 'bg-orange-400' },
  { max: 25, label: 'Very steep', color: 'bg-red-400' },
  { max: 90, label: 'Extreme', color: 'bg-red-600' },
] as const;

const ASPECT_ARROWS: Record<string, number> = {
  north: 0, northeast: 45, east: 90, southeast: 135,
  south: 180, southwest: 225, west: 270, northwest: 315,
};

const INSIGHT_STYLE = {
  critical: {
    Icon: AlertTriangle,
    border: 'border-red-500/60',
    bg: 'bg-red-50 dark:bg-red-950/20',
    iconColor: 'text-red-600 dark:text-red-400',
    label: 'Critical',
    labelBg: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  },
  warning: {
    Icon: AlertTriangle,
    border: 'border-amber-500/60',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Watch',
    labelBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  },
  info: {
    Icon: Info,
    border: 'border-blue-500/60',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Note',
    labelBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  positive: {
    Icon: CheckCircle2,
    border: 'border-green-500/60',
    bg: 'bg-green-50 dark:bg-green-950/20',
    iconColor: 'text-green-600 dark:text-green-400',
    label: 'Good',
    labelBg: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  },
} as const;

function SlopeBar({ degrees }: { degrees: number }) {
  // Find active segment
  const activeIdx = SLOPE_SEGMENTS.findIndex((s) => degrees < s.max);
  const idx = activeIdx === -1 ? SLOPE_SEGMENTS.length - 1 : activeIdx;
  const pct = Math.min(100, (degrees / 45) * 100); // 45° = 100%

  return (
    <div>
      <div className="flex gap-0.5">
        {SLOPE_SEGMENTS.map((seg, i) => (
          <div
            key={seg.label}
            className={`flex-1 h-2 rounded-sm transition-all ${
              i <= idx ? seg.color : 'bg-muted/40'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted-foreground">Flat (0°)</span>
        <span className="text-xs font-medium">{degrees.toFixed(0)}°</span>
        <span className="text-xs text-muted-foreground">Extreme (45°+)</span>
      </div>
    </div>
  );
}

function AspectCompass({ label, degrees }: { label: string; degrees: number | null }) {
  if (!degrees && degrees !== 0) return null;
  const rotation = ASPECT_ARROWS[label] ?? 0;

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 rounded-full border-2 border-border bg-muted/20 flex items-center justify-center shrink-0">
        <span className="absolute -top-1.5 text-[8px] font-bold text-muted-foreground">N</span>
        <ArrowUp
          className="h-5 w-5 text-piq-primary transition-transform"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </div>
      <div>
        <span className="text-sm font-semibold capitalize">{label}-facing</span>
        <p className="text-xs text-muted-foreground">{degrees.toFixed(0)}° from north</p>
      </div>
    </div>
  );
}

function InsightCard({
  insight,
}: {
  insight: NonNullable<ReportSnapshot['terrain_insights']>[number];
}) {
  const [open, setOpen] = useState(false);
  const style = INSIGHT_STYLE[insight.severity] || INSIGHT_STYLE.info;
  const { Icon } = style;

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left"
      >
        <Icon className={`h-4 w-4 ${style.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${style.labelBg}`}
            >
              {style.label}
            </span>
            <span className="text-sm font-semibold">{insight.title}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
            {insight.detail}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-border/30">
          <p className="text-xs text-muted-foreground leading-relaxed mt-3">{insight.detail}</p>
          <div className="mt-3 rounded-md bg-background/60 border border-border/40 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-piq-primary mb-1.5">
              What to do
            </p>
            <p className="text-xs text-foreground leading-relaxed">{insight.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function HostedTerrain({ snapshot }: Props) {
  const terrain = snapshot.terrain;
  const isochrone = snapshot.isochrone;
  const insights = snapshot.terrain_insights ?? [];

  if (!terrain?.elevation_m && !isochrone?.transit_stops_walk_10min) return null;

  const elev = terrain?.elevation_m;
  const slope = terrain?.slope_degrees;
  const slopeCat = terrain?.slope_category ?? 'unknown';
  const aspectLabel = terrain?.aspect_label ?? 'flat';
  const aspectDeg = terrain?.aspect_degrees;
  const source = terrain?.terrain_source;
  const landslideRisk = terrain?.landslide_risk;

  const totalStops = isochrone?.transit_stops_walk_10min ?? 0;
  const busStops = isochrone?.bus_stops_walk_10min ?? 0;
  const railStops = isochrone?.rail_stops_walk_10min ?? 0;
  const ferryStops = isochrone?.ferry_stops_walk_10min ?? 0;
  const isoMethod = isochrone?.isochrone_method;

  const windExposure = terrain?.wind_exposure ?? 'unknown';
  const windScore = terrain?.wind_exposure_score;
  const floodTerrain = terrain?.flood_terrain_risk ?? 'unknown';
  const isDepression = terrain?.is_depression;
  const relativePos = terrain?.relative_position ?? 'unknown';
  const waterwayM = terrain?.nearest_waterway_m;
  const waterwayName = terrain?.nearest_waterway_name;
  const waterwayType = terrain?.nearest_waterway_type;

  const terrainInsights = insights.filter((i) => i.category === 'terrain');
  const walkInsights = insights.filter((i) => i.category === 'walkability');

  return (
    <div className="space-y-6">
      {/* ── Terrain & Topography Card ── */}
      {terrain && elev != null && (
        <div
          id="sec-terrain"
          className="rounded-xl border border-border bg-card card-elevated overflow-hidden scroll-mt-16"
        >
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            <Mountain className="h-5 w-5 text-piq-primary" />
            <h3 className="text-lg font-bold">Terrain & Topography</h3>
          </div>
          <div className="px-5 pb-5 space-y-4">
            {/* Key metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Elevation */}
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Elevation
                </p>
                <p className="text-xl font-bold mt-1 tabular-nums">{elev.toFixed(0)}m</p>
                <p className="text-xs text-muted-foreground">above sea level</p>
              </div>

              {/* Slope */}
              {slope != null && (
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Slope
                  </p>
                  <p className="text-xl font-bold mt-1 tabular-nums">{slope.toFixed(0)}°</p>
                  <p className="text-xs text-muted-foreground capitalize">{slopeCat}</p>
                </div>
              )}

              {/* Aspect */}
              {aspectLabel !== 'flat' && aspectLabel !== 'unknown' && (() => {
                // For multi-unit dwellings (apartments, townhouses, units in a block) the
                // parcel's aspect is largely meaningless. surrounding buildings dominate
                // the actual light the unit gets. Flag that up front instead of claiming
                // "Limited sun" based on raster-derived parcel geometry.
                const detection = (snapshot as unknown as { report?: { property_detection?: { is_multi_unit?: boolean } } }).report?.property_detection;
                const isMultiUnit = !!detection?.is_multi_unit;
                const sunLabel = isMultiUnit
                  ? 'Urban unit. verify'
                  : aspectLabel.includes('north')
                    ? 'Best sun'
                    : aspectLabel.includes('south')
                      ? 'Limited sun'
                      : 'Partial sun';
                return (
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Faces</p>
                    <p className="text-xl font-bold mt-1 capitalize">{aspectLabel}</p>
                    <p className="text-xs text-muted-foreground">{sunLabel}</p>
                  </div>
                );
              })()}

              {/* Landslide risk from slope */}
              {landslideRisk && landslideRisk.slope_risk_score != null && (
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Slope Risk
                  </p>
                  <p
                    className={`text-xl font-bold mt-1 capitalize ${
                      landslideRisk.slope_risk_score >= 4
                        ? 'text-red-600 dark:text-red-400'
                        : landslideRisk.slope_risk_score >= 3
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {landslideRisk.slope_risk.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">landslide susceptibility</p>
                </div>
              )}

              {/* Wind exposure. keep the exposure label on its own line and treat the
                  relative position as a parenthesised qualifier so the card doesn't read
                  as "Wind moderate mid slope" in plain-text dumps. */}
              {windExposure !== 'unknown' && (
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    <Wind className="h-3 w-3" /> Wind
                  </p>
                  <p
                    className={`text-xl font-bold mt-1 capitalize ${
                      windScore != null && windScore >= 4
                        ? 'text-red-600 dark:text-red-400'
                        : windScore != null && windScore >= 3
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {windExposure.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {relativePos !== 'unknown' ? `(${relativePos.replace('-', ' ')})` : 'wind exposure'}
                  </p>
                </div>
              )}

              {/* Flood terrain risk */}
              {floodTerrain !== 'unknown' && floodTerrain !== 'none' && (
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    <Droplets className="h-3 w-3" /> Drainage
                  </p>
                  <p
                    className={`text-xl font-bold mt-1 capitalize ${
                      floodTerrain === 'high'
                        ? 'text-red-600 dark:text-red-400'
                        : floodTerrain === 'moderate'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {floodTerrain}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isDepression ? 'depression. water collects' : 'flood terrain risk'}
                  </p>
                </div>
              )}

              {/* Nearest waterway */}
              {waterwayM != null && waterwayM <= 500 && (
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    <Droplets className="h-3 w-3" /> Waterway
                  </p>
                  <p
                    className={`text-xl font-bold mt-1 tabular-nums ${
                      waterwayM <= 50
                        ? 'text-red-600 dark:text-red-400'
                        : waterwayM <= 100
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {waterwayM}m
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[100px] mx-auto">
                    {waterwayName
                      ? waterwayName
                      : waterwayType === 'river_cl'
                      ? 'nearest river'
                      : waterwayType === 'drain_cl'
                      ? 'nearest stream'
                      : 'nearest waterway'}
                  </p>
                </div>
              )}
            </div>

            {/* Slope bar */}
            {slope != null && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Slope Gradient</h4>
                <SlopeBar degrees={slope} />
              </div>
            )}

            {/* Aspect compass */}
            {aspectLabel !== 'flat' && aspectLabel !== 'unknown' && slope != null && slope >= 3 && (
              <div className="flex items-center justify-between">
                <AspectCompass label={aspectLabel} degrees={aspectDeg ?? null} />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sun className="h-3.5 w-3.5" />
                  <span>
                    {aspectLabel.includes('north')
                      ? 'Maximum winter sun (NZ southern hemisphere)'
                      : aspectLabel.includes('south')
                      ? 'Minimal direct winter sun'
                      : aspectLabel.includes('east')
                      ? 'Morning sun, afternoon shade'
                      : 'Afternoon sun, morning shade'}
                  </span>
                </div>
              </div>
            )}

            {/* Terrain insights */}
            {terrainInsights.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-sm font-semibold">Terrain Analysis</h4>
                {terrainInsights.map((insight, i) => (
                  <InsightCard key={`terrain-${i}`} insight={insight} />
                ))}
              </div>
            )}

            {/* Source */}
            <p className="text-xs text-muted-foreground/60">
              Source: SRTM 30m elevation data via {source === 'valhalla' ? 'Valhalla routing engine' : source === 'postgis' ? 'PostGIS raster analysis' : 'elevation service'}.
              Slope and aspect derived from surrounding elevation samples.
            </p>
          </div>
        </div>
      )}

      {/* ── Walking Reach & Transit Card ── */}
      {isochrone && isoMethod && isoMethod !== 'none' && (
        <div
          id="sec-walking"
          className="rounded-xl border border-border bg-card card-elevated overflow-hidden scroll-mt-16"
        >
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            <Footprints className="h-5 w-5 text-piq-primary" />
            <h3 className="text-lg font-bold">Walking Reach & Transit</h3>
            {isoMethod === 'valhalla' && (
              <span className="ml-auto px-2 py-0.5 rounded-md text-[9px] font-semibold bg-piq-primary/10 text-piq-primary">
                Hill-adjusted
              </span>
            )}
          </div>
          <div className="px-5 pb-5 space-y-4">
            {/* Transit stops summary */}
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">10-minute walk</span>
                <span className="text-2xl font-bold tabular-nums text-piq-primary">
                  {totalStops}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                transit stop{totalStops !== 1 ? 's' : ''} reachable on foot
                {isoMethod === 'valhalla'
                  ? ', accounting for hills and the actual street network'
                  : ' (straight-line estimate)'}
              </p>

              {/* Mode breakdown. show the noun ("stops") so users don't read "17 bus" as "17 bus lines". */}
              {(busStops > 0 || railStops > 0 || ferryStops > 0) && (
                <div className="flex flex-wrap gap-2">
                  {busStops > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                      <Bus className="h-3.5 w-3.5" />
                      {busStops} bus stop{busStops === 1 ? '' : 's'}
                    </span>
                  )}
                  {railStops > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
                      <TrainFront className="h-3.5 w-3.5" />
                      {railStops} rail stop{railStops === 1 ? '' : 's'}
                    </span>
                  )}
                  {ferryStops > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-medium">
                      <Ship className="h-3.5 w-3.5" />
                      {ferryStops} ferry stop{ferryStops === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Hill impact note */}
            {isoMethod === 'valhalla' && slope != null && slope >= 5 && (
              <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/10 p-3">
                <TrendingDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Hills reduce your walking range.</span>{' '}
                  On flat ground, a 10-minute walk covers about 800m. With the {slope.toFixed(0)}° slopes around this
                  property, your actual reach is smaller. stops that look close on a map may involve steep climbs.
                </p>
              </div>
            )}

            {/* Walkability insights */}
            {walkInsights.length > 0 && (
              <div className="space-y-2.5">
                {walkInsights.map((insight, i) => (
                  <InsightCard key={`walk-${i}`} insight={insight} />
                ))}
              </div>
            )}

            {/* Source */}
            <p className="text-xs text-muted-foreground/60">
              {isoMethod === 'valhalla'
                ? 'Walking isochrone computed by Valhalla routing engine using OpenStreetMap road network with SRTM elevation data for hill penalties.'
                : `Estimated using ${totalStops > 0 ? '800m' : ''} straight-line radius (routing engine unavailable).`}
              {' '}Transit stops from Metlink (Wellington) and Auckland Transport GTFS feeds.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
