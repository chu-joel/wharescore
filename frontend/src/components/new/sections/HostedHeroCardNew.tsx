'use client';

import { useState } from 'react';
import { Calendar, Home, TrendingUp, MapPin } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';
import { Card } from '@/components/new/ui/primitives';
import { transformReport } from '@/lib/transformReport';
import { getRatingBin } from '@/lib/constants';
import { effectivePerUnitCv, formatCurrency, resolveFloorArea } from '@/lib/format';

interface Props {
  snapshot: ReportSnapshot;
  variant: 'quick' | 'full';
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

/**
 * A8-style hero card for the hosted report shell.
 *
 * Two-column card: text + score on the left, stat grid + property image on
 * the right. Uses Google Street View Static API for the photo (falls back
 * to Static Maps when no Street View imagery is available for the address).
 */
export function HostedHeroCardNew({ snapshot, variant }: Props) {
  const report = transformReport(
    snapshot.report,
    (snapshot as unknown as { rates_data?: unknown }).rates_data,
  );

  const persona = snapshot.meta.persona;
  const score = report.scores?.overall;
  const hasScore = Number.isFinite(score);
  const bin = hasScore ? getRatingBin(score as number) : null;

  const detection = report.property_detection;
  const isMultiUnit = !!detection?.is_multi_unit;
  const unitCount = detection?.unit_count ?? 1;

  const cv = effectivePerUnitCv(report.property.capital_value, {
    isMultiUnit,
    unitCount,
  });
  const floor = resolveFloorArea(report.property, {
    isMultiUnit,
    titleType: report.property.title_type,
  });

  const rawProp = (snapshot.report?.property ?? {}) as Record<string, unknown>;
  const titleType = (rawProp.title_type as string | undefined) ?? null;
  const titleRef = (rawProp.title_ref as string | undefined) ?? null;
  const buildingUse = (rawProp.building_use as string | undefined) ?? null;
  const cvDate = (rawProp.cv_date as string | undefined) ?? null;
  const propertyType =
    (titleType && titleType !== 'Unknown' ? titleType : null) ||
    (buildingUse && buildingUse !== 'Unknown' ? buildingUse : null);

  const generatedDate = new Date(snapshot.meta.generated_at).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Sub-line: compose key context (location + property kind + standout hazards/score)
  const subParts: string[] = [];
  if (snapshot.meta.sa2_name) subParts.push(snapshot.meta.sa2_name);
  if (propertyType) subParts.push(propertyType.toLowerCase());
  if (floor) subParts.push(`${floor.value.toLocaleString()} m² ${floor.label.toLowerCase()}`);
  if (report.coverage) subParts.push(`${report.coverage.available} of ${report.coverage.total} layers`);
  const subline = subParts.length > 0 ? subParts.join(' · ') : snapshot.meta.ta_name;

  // Stat grid rows
  const stats: { lbl: string; val: string }[] = [];
  if (titleType && titleType !== 'Unknown') stats.push({ lbl: 'Title', val: titleType });
  if (titleRef) stats.push({ lbl: 'Title #', val: titleRef });
  if (floor) stats.push({ lbl: floor.label, val: `${floor.value.toLocaleString()} m²` });
  if (report.property.land_value) stats.push({ lbl: 'Land value', val: formatCurrency(report.property.land_value) });
  if (cv) stats.push({ lbl: isMultiUnit && unitCount > 1 ? 'CV (per unit)' : 'CV', val: formatCurrency(cv) });
  if (cvDate) stats.push({ lbl: 'CV date', val: formatCvDate(cvDate) });
  if (snapshot.meta.ta_name) stats.push({ lbl: 'Council', val: shortenCouncil(snapshot.meta.ta_name) });
  if (isMultiUnit && unitCount > 1) stats.push({ lbl: 'Multi-unit', val: `${unitCount} units` });

  // Score ring math (matches A8: r=42, circumference ≈ 263.9)
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = hasScore ? circumference * (1 - (score as number) / 100) : circumference;
  const ringStroke = bin?.color ?? 'var(--ws-piq)';

  // Property image — Street View static, with fallback to map
  const lat = report.address?.lat;
  const lng = report.address?.lng;

  return (
    <Card>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
        minHeight: 320,
      }}
        className="ws-hero-grid"
      >
        {/* LEFT — text + score */}
        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--ws-piq)', marginBottom: 12,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ws-piq)' }} />
              {persona === 'renter' ? <Home size={12} /> : <TrendingUp size={12} />}
              WhareScore {variant === 'quick' ? 'Quick Report' : 'Full Report'}
            </div>

            <h1 style={{
              margin: '0 0 8px',
              fontSize: 'clamp(24px, 3.6vw, 36px)', fontWeight: 800,
              lineHeight: 1.05, letterSpacing: '-0.02em',
              color: 'var(--ws-ink)', wordBreak: 'break-word',
            }}>
              {snapshot.meta.full_address}
            </h1>

            <p style={{
              margin: '0 0 18px',
              fontSize: 13.5, color: 'var(--ws-ink-soft)', maxWidth: '52ch',
            }}>
              {subline}
            </p>

            {hasScore && bin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '12px 0 4px' }}>
                <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--ws-rule)" strokeWidth={8} />
                    <circle
                      cx="50" cy="50" r={radius} fill="none" stroke={ringStroke}
                      strokeWidth={8} strokeLinecap="round"
                      strokeDasharray={circumference.toFixed(1)}
                      strokeDashoffset={dashOffset.toFixed(1)}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <strong style={{
                        display: 'block', fontSize: 26, fontWeight: 800,
                        color: 'var(--ws-ink)', lineHeight: 1, letterSpacing: '-0.02em',
                      }}>
                        {(score as number).toFixed(1)}
                      </strong>
                      <small style={{ fontSize: 10, color: 'var(--ws-ink-mute)', marginTop: 2, display: 'block' }}>
                        /100
                      </small>
                    </div>
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'inline-block',
                    background: bin.color, color: 'oklch(0.18 0.04 70)',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: 4, marginBottom: 6,
                  }}>
                    {bin.label}
                  </span>
                  <div style={{ fontSize: 13, color: 'var(--ws-ink-soft)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--ws-ink)', fontWeight: 600, textTransform: 'capitalize' }}>{persona}</strong> persona
                    {report.coverage && (
                      <> · <strong style={{ color: 'var(--ws-ink)', fontWeight: 600 }}>
                        {Math.round((report.coverage.available / report.coverage.total) * 100)}%
                      </strong> coverage</>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={11} />
            Generated {generatedDate}
          </p>
        </div>

        {/* RIGHT — stat grid + property image */}
        <aside style={{
          background: 'var(--ws-bg-2)',
          borderLeft: '1px solid var(--ws-rule)',
          display: 'grid', gridTemplateRows: 'auto 1fr',
          minHeight: 0,
        }}
          className="ws-hero-side"
        >
          {stats.length > 0 && (
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--ws-rule)' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '10px 18px',
              }}>
                {stats.map((s) => (
                  <div key={s.lbl}>
                    <div style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: 'var(--ws-ink-mute)', marginBottom: 2,
                    }}>
                      {s.lbl}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ws-ink)' }}>
                      {s.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <PropertyImage lat={lat} lng={lng} address={snapshot.meta.full_address} />
        </aside>
      </div>
    </Card>
  );
}

function PropertyImage({ lat, lng, address }: { lat?: number | null; lng?: number | null; address: string }) {
  const [streetViewFailed, setStreetViewFailed] = useState(false);

  if (!lat || !lng) {
    return (
      <div style={fallbackStyle}>
        <MapPin size={24} style={{ color: 'var(--ws-ink-mute)', opacity: 0.5 }} />
      </div>
    );
  }

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div style={fallbackStyle}>
        <MapPin size={24} style={{ color: 'var(--ws-ink-mute)', opacity: 0.5 }} />
      </div>
    );
  }

  // Street View at typical eye level pointing toward the property
  const streetViewSrc = `https://maps.googleapis.com/maps/api/streetview?size=640x320&location=${lat},${lng}&fov=80&pitch=0&key=${GOOGLE_MAPS_KEY}`;
  const staticMapSrc = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=640x320&maptype=roadmap&markers=color:0x0d7377%7C${lat},${lng}&key=${GOOGLE_MAPS_KEY}`;

  return (
    <div style={{ position: 'relative', minHeight: 200, background: 'var(--ws-bg-2)' }}>
      <img
        src={streetViewFailed ? staticMapSrc : streetViewSrc}
        alt={`${streetViewFailed ? 'Map' : 'Street view'} of ${address}`}
        onError={() => setStreetViewFailed(true)}
        style={{
          width: '100%', height: '100%', minHeight: 200,
          objectFit: 'cover', display: 'block',
        }}
        loading="lazy"
      />
    </div>
  );
}

const fallbackStyle: React.CSSProperties = {
  display: 'grid', placeItems: 'center', minHeight: 200,
  background: 'var(--ws-bg-2)',
};

function formatCvDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function shortenCouncil(name: string): string {
  // "Wellington City" -> "WCC", "Auckland" -> "AKL", etc. Keep short for the stat cell.
  const map: Record<string, string> = {
    'Wellington City': 'WCC',
    'Auckland': 'AKL',
    'Christchurch City': 'CCC',
    'Hamilton City': 'HCC',
    'Tauranga City': 'TCC',
    'Dunedin City': 'DCC',
    'Lower Hutt City': 'HCC',
    'Upper Hutt City': 'UHCC',
    'Porirua City': 'PCC',
  };
  return map[name] ?? name;
}
