'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { GripVertical } from 'lucide-react';
import { ChevronDown } from 'lucide-react';

interface SplitViewProps {
  map: React.ReactNode;
  panel: React.ReactNode;
}

const MIN_PANEL_PERCENT = 30;
const MAX_PANEL_PERCENT = 55;
const DEFAULT_PANEL_PERCENT = 40;

export function SplitView({ map, panel }: SplitViewProps) {
  const [panelPercent, setPanelPercent] = useState(DEFAULT_PANEL_PERCENT);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = 100 - (x / rect.width) * 100;
      setPanelPercent(Math.min(MAX_PANEL_PERCENT, Math.max(MIN_PANEL_PERCENT, percent)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  return (
    <div ref={containerRef} className="flex h-[calc(100vh-56px)]">
      {/* Map side */}
      <div
        className="relative transition-[width] duration-75"
        style={{ width: `${100 - panelPercent}%` }}
      >
        {map}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`relative w-1 cursor-col-resize group flex items-center justify-center hover:bg-piq-primary/20 transition-colors ${
          isDragging ? 'bg-piq-primary/30' : 'bg-border'
        }`}
      >
        <div
          className={`absolute z-10 flex items-center justify-center w-5 h-10 rounded-full bg-background border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${
            isDragging ? 'opacity-100' : ''
          }`}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Panel side */}
      <PanelWithScrollHint panelPercent={panelPercent}>
        {panel}
      </PanelWithScrollHint>
    </div>
  );
}

function PanelWithScrollHint({ panelPercent, children }: { panelPercent: number; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const check = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setShowHint(!atBottom && el.scrollHeight > el.clientHeight + 100);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); };
  }, []);

  return (
    <div className="relative" style={{ width: `${panelPercent}%` }}>
      <div
        ref={panelRef}
        className="overflow-y-auto overflow-x-hidden bg-background h-full"
      >
        {children}
      </div>
      {showHint && (
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
          <div className="h-16 bg-gradient-to-t from-background to-transparent" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-auto">
            <button
              onClick={() => panelRef.current?.scrollBy({ top: 300, behavior: 'smooth' })}
              className="flex items-center gap-1 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm border border-border rounded-full px-3 py-1 shadow-sm hover:text-foreground transition-colors"
            >
              <ChevronDown className="h-3 w-3" />
              Scroll for more
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
