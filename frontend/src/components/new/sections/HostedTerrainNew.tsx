'use client';

import {
  Mountain,
  ArrowUp,
  Sun,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
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
import { Card, CardHead } from '@/components/new/ui/primitives';

interface Props {
  snapshot: ReportSnapshot;
}

const SLOPE_SEGMENTS = [
  { max: 2, label: 'Flat', color: 'var(--ws-success)' },
  { max: 5, label: 'Gentle', color: 'var(--ws-r-vlow, #56B4E9)' },
  { max: 10, label: 'Moderate', color: 'var(--ws-r-mod, #E69F00)' },
  { max: 15, label: 'Steep', color: 'var(--ws-r-high)' },
  { max: 25, label: 'Very steep', color: 'var(--ws-r-vhigh)' },
  { max: 90, label: 'Extreme', color: 'var(--ws-r-vhigh)' },
] as const;

const ASPECT_ARROWS: Record<string, number> = {
  north: 0, northeast: 45, east: 90, southeast: 135,
  south: 180, southwest: 225, west: 270, northwest: 315,
};

type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive';
const INSIGHT_STYLE: Record<InsightSeverity, {
  Icon: typeof AlertTriangle;
  border: string; bg: string; iconColor: string; label: string;
}> = {
  critical: {
    Icon: AlertTriangle, border: 'rgba(196,45,45,.40)', bg: 'rgba(196,45,45,.06)',
    iconColor: 'var(--ws-r-vhigh)', label: 'Critical',
  },
  warning: {
    Icon: AlertTriangle, border: 'rgba(213,94,0,.40)', bg: 'rgba(213,94,0,.06)',
    iconColor: 'var(--ws-r-high)', label: 'Watch',
  },
  info: {
    Icon: Info, border: 'rgba(13,115,119,.30)', bg: 'rgba(13,115,119,.05)',
    iconColor: 'var(--ws-piq)', label: 'Note',
  },
  positive: {
    Icon: CheckCircle2, border: 'rgba(35,134,54,.30)', bg: 'rgba(35,134,54,.06)',
    iconColor: 'var(--ws-success)', label: 'Good',
  },
};

function severityForScore(score: number | null | undefined): 'high' | 'mod' | 'low' {
  if (score == null) return 'low';
  if (score >= 4) return 'high';
  if (score >= 3) return 'mod';
  return 'low';
}
const SCORE_COLOR: Record<'high' | 'mod' | 'low', string> = {
  high: 'var(--ws-r-vhigh)',
  mod: 'var(--ws-r-high)',
  low: 'var(--ws-success)',
};

function SlopeBar({ degrees }: { degrees: number }) {
  const activeIdx = SLOPE_SEGMENTS.findIndex((s) => degrees < s.max);
  const idx = activeIdx === -1 ? SLOPE_SEGMENTS.length - 1 : activeIdx;
  return (
    <div>
      <div style={{ display: 'flex', gap: 2 }}>
        {SLOPE_SEGMENTS.map((seg, i) => (
          <div
            key={seg.label}
            style={{
              flex: 1, height: 8, borderRadius: 2,
              background: i <= idx ? seg.color : 'var(--ws-bg-2)',
              transition: 'background 200ms',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--ws-ink-mute)' }}>Flat (0°)</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ws-ink)' }}>{degrees.toFixed(0)}°</span>
        <span style={{ fontSize: 11, color: 'var(--ws-ink-mute)' }}>Extreme (45°+)</span>
      </div>
    </div>
  );
}

function AspectCompass({ label, degrees }: { label: string; degrees: number | null }) {
  if (!degrees && degrees !== 0) return null;
  const rotation = ASPECT_ARROWS[label] ?? 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        position: 'relative', width: 40, height: 40, borderRadius: '50%',
        border: '2px solid var(--ws-rule)', background: 'var(--ws-bg-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ position: 'absolute', top: -6, fontSize: 8, fontWeight: 700, color: 'var(--ws-ink-mute)' }}>N</span>
        <ArrowUp size={20} style={{ color: 'var(--ws-piq)', transform: `rotate(${rotation}deg)`, transition: 'transform 200ms' }} />
      </div>
      <div>
        <span style={{ fontSize: 13.5, fontWeight: 600, textTransform: 'capitalize', color: 'var(--ws-ink)' }}>{label}-facing</span>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ws-ink-mute)' }}>{degrees.toFixed(0)}° from north</p>
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: NonNullable<ReportSnapshot['terrain_insights']>[number] }) {
  const [open, setOpen] = useState(false);
  const style = INSIGHT_STYLE[insight.severity as InsightSeverity] || INSIGHT_STYLE.info;
  const { Icon } = style;

  return (
    <div style={{
      borderRadius: 'var(--ws-radius-sm)',
      border: `1px solid ${style.border}`,
      background: style.bg,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '12px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 0,
          minHeight: 44,
        }}
      >
        <Icon size={16} style={{ color: style.iconColor, flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              padding: '1px 6px', borderRadius: 3,
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: style.iconColor, background: 'var(--ws-surface)',
            }}>
              {style.label}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)' }}>{insight.title}</span>
          </div>
          <p style={{
            margin: '4px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.55,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {insight.detail}
          </p>
        </div>
        <ChevronDown size={16} style={{
          color: 'var(--ws-ink-mute)', flexShrink: 0, marginTop: 2,
          transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms',
        }} />
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--ws-rule)' }}>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>{insight.detail}</p>
          <div style={{
            marginTop: 10,
            borderRadius: 'var(--ws-radius-sm)',
            background: 'var(--ws-surface)',
            border: '1px solid var(--ws-rule)',
            padding: 12,
          }}>
            <p style={{
              margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--ws-piq-dark)', marginBottom: 6,
            }}>
              What to do
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink)', lineHeight: 1.55 }}>{insight.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, hint, valueColor, icon }: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  valueColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div style={{
      borderRadius: 'var(--ws-radius-sm)',
      border: '1px solid var(--ws-rule)',
      padding: 12,
      textAlign: 'center',
    }}>
      <p style={{
        margin: 0, fontSize: 10.5, color: 'var(--ws-ink-mute)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        {icon}
        {label}
      </p>
      <p style={{
        margin: '4px 0 0', fontSize: 18, fontWeight: 700,
        fontVariantNumeric: 'tabular-nums', textTransform: 'capitalize',
        color: valueColor ?? 'var(--ws-ink)',
      }}>
        {value}
      </p>
      {hint && <p style={{ margin: 0, fontSize: 11, color: 'var(--ws-ink-mute)' }}>{hint}</p>}
    </div>
  );
}

export function HostedTerrainNew({ snapshot }: Props) {
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
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Terrain & Topography */}
      {terrain && elev != null && (
        <Card>
          <div id="sec-terrain" style={{ scrollMarginTop: 64 }}>
            <CardHead
              title="Terrain & Topography"
              meta={<Mountain size={16} style={{ color: 'var(--ws-piq)' }} />}
            />
            <div className="ws-card-body" style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <MetricCard label="Elevation" value={`${elev.toFixed(0)}m`} hint="above sea level" />

                {slope != null && (
                  <MetricCard label="Slope" value={`${slope.toFixed(0)}°`} hint={slopeCat} />
                )}

                {aspectLabel !== 'flat' && aspectLabel !== 'unknown' && (() => {
                  const detection = (snapshot as unknown as { report?: { property_detection?: { is_multi_unit?: boolean } } }).report?.property_detection;
                  const isMultiUnit = !!detection?.is_multi_unit;
                  const sunLabel = isMultiUnit
                    ? 'Urban unit. verify'
                    : aspectLabel.includes('north')
                      ? 'Best sun'
                      : aspectLabel.includes('south')
                        ? 'Limited sun'
                        : 'Partial sun';
                  return <MetricCard label="Faces" value={aspectLabel} hint={sunLabel} />;
                })()}

                {landslideRisk && landslideRisk.slope_risk_score != null && (
                  <MetricCard
                    label="Slope Risk"
                    value={landslideRisk.slope_risk.replace('_', ' ')}
                    hint="landslide susceptibility"
                    valueColor={SCORE_COLOR[severityForScore(landslideRisk.slope_risk_score)]}
                  />
                )}

                {windExposure !== 'unknown' && (
                  <MetricCard
                    label="Wind"
                    icon={<Wind size={11} />}
                    value={windExposure.replace('_', ' ')}
                    hint={relativePos !== 'unknown' ? `(${relativePos.replace('-', ' ')})` : 'wind exposure'}
                    valueColor={SCORE_COLOR[severityForScore(windScore)]}
                  />
                )}

                {floodTerrain !== 'unknown' && floodTerrain !== 'none' && (
                  <MetricCard
                    label="Drainage"
                    icon={<Droplets size={11} />}
                    value={floodTerrain}
                    hint={isDepression ? 'depression. water collects' : 'flood terrain risk'}
                    valueColor={
                      floodTerrain === 'high' ? 'var(--ws-r-vhigh)'
                        : floodTerrain === 'moderate' ? 'var(--ws-r-high)'
                        : 'var(--ws-success)'
                    }
                  />
                )}

                {waterwayM != null && waterwayM <= 500 && (
                  <MetricCard
                    label="Waterway"
                    icon={<Droplets size={11} />}
                    value={`${waterwayM}m`}
                    hint={
                      waterwayName
                        ? waterwayName
                        : waterwayType === 'river_cl'
                        ? 'nearest river'
                        : waterwayType === 'drain_cl'
                        ? 'nearest stream'
                        : 'nearest waterway'
                    }
                    valueColor={
                      waterwayM <= 50 ? 'var(--ws-r-vhigh)'
                        : waterwayM <= 100 ? 'var(--ws-r-high)'
                        : 'var(--ws-ink-mute)'
                    }
                  />
                )}
              </div>

              {slope != null && (
                <div>
                  <h4 style={subHeading}>Slope Gradient</h4>
                  <SlopeBar degrees={slope} />
                </div>
              )}

              {aspectLabel !== 'flat' && aspectLabel !== 'unknown' && slope != null && slope >= 3 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <AspectCompass label={aspectLabel} degrees={aspectDeg ?? null} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>
                    <Sun size={13} />
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

              {terrainInsights.length > 0 && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <h4 style={subHeading}>Terrain Analysis</h4>
                  {terrainInsights.map((insight, i) => (
                    <InsightCard key={`terrain-${i}`} insight={insight} />
                  ))}
                </div>
              )}

              <p style={{ margin: 0, fontSize: 11, color: 'var(--ws-ink-mute)' }}>
                Source: SRTM 30m elevation data via {source === 'valhalla' ? 'Valhalla routing engine' : source === 'postgis' ? 'PostGIS raster analysis' : 'elevation service'}.
                Slope and aspect derived from surrounding elevation samples.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Walking Reach & Transit */}
      {isochrone && isoMethod && isoMethod !== 'none' && (
        <Card>
          <div id="sec-walking" style={{ scrollMarginTop: 64 }}>
            <CardHead
              title="Walking Reach & Transit"
              meta={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Footprints size={16} style={{ color: 'var(--ws-piq)' }} />
                  {isoMethod === 'valhalla' && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 4,
                      fontSize: 9.5, fontWeight: 600,
                      background: 'rgba(13,115,119,.10)', color: 'var(--ws-piq-dark)',
                    }}>
                      Hill-adjusted
                    </span>
                  )}
                </span>
              }
            />
            <div className="ws-card-body" style={{ display: 'grid', gap: 14 }}>
              <div style={{
                borderRadius: 'var(--ws-radius-sm)',
                border: '1px solid var(--ws-rule)',
                background: 'var(--ws-bg-2)',
                padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)' }}>10-minute walk</span>
                  <span style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ws-piq)' }}>
                    {totalStops}
                  </span>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>
                  transit stop{totalStops !== 1 ? 's' : ''} reachable on foot
                  {isoMethod === 'valhalla'
                    ? ', accounting for hills and the actual street network'
                    : ' (straight-line estimate)'}
                </p>

                {(busStops > 0 || railStops > 0 || ferryStops > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {busStops > 0 && (
                      <span style={modePill('rgba(13,115,119,.10)', 'var(--ws-piq-dark)')}>
                        <Bus size={13} />
                        {busStops} bus stop{busStops === 1 ? '' : 's'}
                      </span>
                    )}
                    {railStops > 0 && (
                      <span style={modePill('rgba(95,29,140,.10)', '#5F1D8C')}>
                        <TrainFront size={13} />
                        {railStops} rail stop{railStops === 1 ? '' : 's'}
                      </span>
                    )}
                    {ferryStops > 0 && (
                      <span style={modePill('rgba(86,180,233,.12)', '#0E6BA8')}>
                        <Ship size={13} />
                        {ferryStops} ferry stop{ferryStops === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {isoMethod === 'valhalla' && slope != null && slope >= 5 && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  borderRadius: 'var(--ws-radius-sm)',
                  border: '1px solid var(--ws-rule)',
                  background: 'var(--ws-bg-2)',
                  padding: 12,
                }}>
                  <TrendingDown size={16} style={{ color: 'var(--ws-ink-mute)', flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.55 }}>
                    <span style={{ fontWeight: 600, color: 'var(--ws-ink)' }}>Hills reduce your walking range.</span>{' '}
                    On flat ground, a 10-minute walk covers about 800m. With the {slope.toFixed(0)}° slopes around this
                    property, your actual reach is smaller. stops that look close on a map may involve steep climbs.
                  </p>
                </div>
              )}

              {walkInsights.length > 0 && (
                <div style={{ display: 'grid', gap: 10 }}>
                  {walkInsights.map((insight, i) => (
                    <InsightCard key={`walk-${i}`} insight={insight} />
                  ))}
                </div>
              )}

              <p style={{ margin: 0, fontSize: 11, color: 'var(--ws-ink-mute)' }}>
                {isoMethod === 'valhalla'
                  ? 'Walking isochrone computed by Valhalla routing engine using OpenStreetMap road network with SRTM elevation data for hill penalties.'
                  : `Estimated using ${totalStops > 0 ? '800m' : ''} straight-line radius (routing engine unavailable).`}
                {' '}Transit stops from Metlink (Wellington) and Auckland Transport GTFS feeds.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

const subHeading: React.CSSProperties = {
  margin: '0 0 8px', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ws-ink-mute)',
};

function modePill(bg: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 8,
    background: bg, color,
    fontSize: 11.5, fontWeight: 500,
  };
}
