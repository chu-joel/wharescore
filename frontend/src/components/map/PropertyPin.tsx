'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

interface PropertyPinProps {
  map: maplibregl.Map | null;
  lng: number;
  lat: number;
  color?: string;
}

/**
 * Imperative MapLibre marker for use outside react-map-gl.
 * For most cases, use the <Marker> from react-map-gl instead (as in MapContainer).
 * This component is useful when you need to add markers to a raw maplibregl.Map instance.
 */
export function PropertyPin({ map, lng, lat, color = '#0D7377' }: PropertyPinProps) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const safeColor = /^#[0-9A-Fa-f]{3,8}$/.test(color) ? color : '#0D7377';

  useEffect(() => {
    if (!map) return;

    // Create custom marker element
    const el = document.createElement('div');
    el.className = 'property-pin-marker';
    el.innerHTML = `
      <div style="position:relative;">
        <div style="position:absolute;inset:-12px;display:flex;align-items:center;justify-content:center;">
          <div style="width:24px;height:24px;border-radius:50%;background:${safeColor}33;animation:pulse-ring 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
        </div>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="${safeColor}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));animation:bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `;

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map);

    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, lng, lat, color]);

  return null;
}
