'use client';

import { useState, useCallback } from 'react';
import { Plus, Minus, Locate, Map as MapIcon } from 'lucide-react';
import { useMapStore } from '@/stores/mapStore';
import type { MapRef } from 'react-map-gl/maplibre';
import { TIMING } from '@/lib/animations';

interface MapControlsProps {
  mapRef: React.RefObject<MapRef | null>;
}

function ControlButton({
  onClick,
  label,
  disabled,
  children,
  className = '',
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-10 w-10 rounded-lg bg-background/95 backdrop-blur-sm border border-border shadow-sm flex items-center justify-center hover:bg-muted active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-piq-primary focus-visible:ring-offset-2 ${className}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export function MapControls({ mapRef }: MapControlsProps) {
  const viewport = useMapStore((s) => s.viewport);
  const setViewport = useMapStore((s) => s.setViewport);
  const resetViewport = useMapStore((s) => s.resetViewport);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(false);

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const zoomIn = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (reducedMotion) {
      map.jumpTo({ zoom: Math.min(viewport.zoom + 1, 18) });
    } else {
      map.zoomIn({ duration: 300 });
    }
  }, [mapRef, viewport.zoom, reducedMotion]);

  const zoomOut = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (reducedMotion) {
      map.jumpTo({ zoom: Math.max(viewport.zoom - 1, 5) });
    } else {
      map.zoomOut({ duration: 300 });
    }
  }, [mapRef, viewport.zoom, reducedMotion]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    setLocateError(false);

    const onSuccess = (pos: GeolocationPosition) => {
      const map = mapRef.current?.getMap();
      if (map) {
        if (reducedMotion) {
          map.jumpTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 16,
          });
        } else {
          map.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 16,
            duration: TIMING.MAP_FLY_TO,
          });
        }
      }
      setViewport({
        longitude: pos.coords.longitude,
        latitude: pos.coords.latitude,
        zoom: 16,
      });
      setLocating(false);
    };

    const onError = (err: GeolocationPositionError) => {
      // iOS sometimes fails with high accuracy — retry with low accuracy
      if (err.code === err.TIMEOUT) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          () => {
            setLocateError(true);
            setLocating(false);
            setTimeout(() => setLocateError(false), 3000);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
        return;
      }
      setLocateError(true);
      setLocating(false);
      setTimeout(() => setLocateError(false), 3000);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  }, [mapRef, setViewport, reducedMotion]);

  const handleReset = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      if (reducedMotion) {
        map.jumpTo({ center: [174.776, -41.290], zoom: 14 });
      } else {
        map.flyTo({
          center: [174.776, -41.290],
          zoom: 14,
          duration: TIMING.MAP_FLY_TO,
        });
      }
    }
    resetViewport();
  }, [mapRef, resetViewport, reducedMotion]);

  return (
    <div className="absolute bottom-80 right-3 lg:top-14 lg:bottom-auto lg:right-3 z-20 flex flex-col gap-1">
      <ControlButton onClick={zoomIn} label="Zoom in" disabled={viewport.zoom >= 18}>
        <Plus className="h-4 w-4" />
      </ControlButton>

      <ControlButton onClick={zoomOut} label="Zoom out" disabled={viewport.zoom <= 5}>
        <Minus className="h-4 w-4" />
      </ControlButton>

      <div className="h-1" />

      <ControlButton
        onClick={locate}
        label={locateError ? 'Location denied' : locating ? 'Locating...' : 'My location'}
        disabled={locating}
        className={locateError ? 'border-risk-high/50' : ''}
      >
        <Locate
          className={`h-4 w-4 ${locating ? 'animate-pulse text-piq-primary' : ''} ${locateError ? 'text-risk-high' : ''}`}
        />
      </ControlButton>

      <ControlButton onClick={handleReset} label="Reset view">
        <MapIcon className="h-3.5 w-3.5" />
      </ControlButton>
    </div>
  );
}
