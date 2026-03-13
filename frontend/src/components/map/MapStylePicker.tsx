'use client';

import { useState, useRef, useEffect } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { BASEMAP_STYLES } from '@/lib/basemapStyles';

function StyleCard({
  id,
  label,
  color,
  previewUrl,
  isActive,
  size,
  onClick,
}: {
  id: string;
  label: string;
  color: string;
  previewUrl: string;
  isActive: boolean;
  size: 'sm' | 'lg';
  onClick: () => void;
}) {
  const dim = size === 'lg' ? 72 : 60;

  return (
    <button
      onClick={onClick}
      aria-label={`${label} map style`}
      aria-pressed={isActive}
      className="flex flex-col items-center gap-1 group focus-visible:outline-none"
    >
      <div
        style={{
          width: dim,
          height: dim,
          borderRadius: 10,
          overflow: 'hidden',
          backgroundColor: color,
          border: isActive
            ? '2.5px solid var(--color-piq-primary, #0D7377)'
            : '2px solid rgba(0,0,0,0.15)',
          boxShadow: isActive
            ? '0 0 0 3px rgba(13,115,119,0.25)'
            : '0 2px 6px rgba(0,0,0,0.2)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <img
          src={previewUrl}
          alt={`${label} map style preview`}
          width={dim}
          height={dim}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="eager"
        />
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? 'var(--color-piq-primary, #0D7377)' : 'rgba(0,0,0,0.6)',
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function MapStylePicker() {
  const [expanded, setExpanded] = useState(false);
  const baseStyleId = useMapStore((s) => s.baseStyleId);
  const setBaseStyle = useMapStore((s) => s.setBaseStyle);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  const current = BASEMAP_STYLES.find((s) => s.id === baseStyleId) ?? BASEMAP_STYLES[0];

  return (
    <div ref={containerRef} className="absolute bottom-4 right-3 z-20">
      {expanded ? (
        <div className="flex gap-3 p-3 bg-background/95 backdrop-blur-sm rounded-2xl border border-border shadow-xl animate-slide-up-fade">
          {BASEMAP_STYLES.map((style) => (
            <StyleCard
              key={style.id}
              id={style.id}
              label={style.label}
              color={style.color}
              previewUrl={style.previewUrl}
              isActive={style.id === baseStyleId}
              size="lg"
              onClick={() => {
                setBaseStyle(style.id);
                setExpanded(false);
              }}
            />
          ))}
        </div>
      ) : (
        <StyleCard
          id={current.id}
          label={current.label}
          color={current.color}
          previewUrl={current.previewUrl}
          isActive={false}
          size="sm"
          onClick={() => setExpanded(true)}
        />
      )}
    </div>
  );
}
