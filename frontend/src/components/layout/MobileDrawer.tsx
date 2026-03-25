'use client';

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/**
 * Custom mobile bottom-sheet drawer.
 *
 * Two snap points:
 *   peek = 220 px from bottom  (search bar + chips visible)
 *   full = 100 % of viewport minus header (full report)
 */

// ─── snap helpers ──────────────────────────────────────────────
type SnapId = 'peek' | 'full';

const HEADER_HEIGHT = 56; // px — AppHeader height

function snapToPx(id: SnapId, vh: number): number {
  const maxHeight = vh - HEADER_HEIGHT;
  switch (id) {
    case 'peek':
      return Math.min(220, maxHeight);
    case 'full':
      return maxHeight;
  }
}

// ─── component ─────────────────────────────────────────────────
interface MobileDrawerProps {
  children: ReactNode;
  hasSelection?: boolean;
}

export function MobileDrawer({ children, hasSelection = false }: MobileDrawerProps) {
  const [snapId, setSnapId] = useState<SnapId>('peek');
  const [vh, setVh] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );

  // Track viewport height for snap calculations
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // When a property is selected, auto-snap to full
  useEffect(() => {
    setSnapId(hasSelection ? 'full' : 'peek');
  }, [hasSelection]);

  // Listen for "snap to full" events
  useEffect(() => {
    const handler = () => setSnapId('full');
    window.addEventListener('drawer:snap-full', handler);
    return () => window.removeEventListener('drawer:snap-full', handler);
  }, []);

  // Back button support
  useEffect(() => {
    const handlePopState = () => {
      setSnapId('peek');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── drag handling ──
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const currentHeight = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const visibleHeight = snapToPx(snapId, vh);
  const maxHeight = vh - HEADER_HEIGHT;

  const hasMoved = useRef(false);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-drawer-handle]')) return;

      dragging.current = true;
      hasMoved.current = false;
      startY.current = e.clientY;
      startHeight.current = snapToPx(snapId, vh);
      currentHeight.current = startHeight.current;

      if (sheetRef.current) {
        sheetRef.current.style.transition = 'none';
      }

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [snapId, vh],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current || !sheetRef.current) return;

      const dy = startY.current - e.clientY; // positive = dragging up
      if (Math.abs(dy) > 5) hasMoved.current = true;

      let newHeight = startHeight.current + dy;

      // Clamp: never go below peek or above full
      const peekPx = snapToPx('peek', vh);
      newHeight = Math.max(peekPx, Math.min(maxHeight, newHeight));

      currentHeight.current = newHeight;
      sheetRef.current.style.height = `${newHeight}px`;
    },
    [vh, maxHeight],
  );

  const onPointerUp = useCallback(() => {
    if (!dragging.current || !sheetRef.current) return;
    dragging.current = false;

    // Re-enable transition
    sheetRef.current.style.transition = '';
    sheetRef.current.style.height = '';

    // Tap without drag — toggle between peek and full
    if (!hasMoved.current) {
      setSnapId((prev) => (prev === 'peek' ? 'full' : 'peek'));
      return;
    }

    const h = currentHeight.current;
    const peekPx = snapToPx('peek', vh);
    const fullPx = snapToPx('full', vh);
    const midpoint = (peekPx + fullPx) / 2;

    // Also factor in drag direction for responsiveness
    const dragDelta = h - startHeight.current;

    let target: SnapId;
    if (Math.abs(dragDelta) > 60) {
      // Intentional drag — follow direction
      target = dragDelta > 0 ? 'full' : 'peek';
    } else {
      // Small drag — snap to nearest
      target = h > midpoint ? 'full' : 'peek';
    }

    setSnapId(target);
  }, [vh]);

  // Push history state when going to full
  useEffect(() => {
    if (snapId === 'full') {
      window.history.pushState({ drawer: 'full' }, '');
    }
  }, [snapId]);

  // Stop touch events from passing through the drawer to the map
  const stopPropagation = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-label="Property information panel"
      className="fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-2xl bg-background border-t border-border shadow-[0_-4px_30px_rgba(0,0,0,0.3)]"
      style={{
        height: `${visibleHeight}px`,
        transition: 'height 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={stopPropagation}
      onTouchMove={stopPropagation}
      onTouchEnd={stopPropagation}
    >
      {/* Drag handle */}
      <div
        data-drawer-handle
        className="flex flex-col items-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="h-1.5 w-10 rounded-full bg-muted-foreground/50" />
      </div>

      {/* Scrollable content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
        style={{ touchAction: 'pan-y' }}
      >
        <h2 className="sr-only">Property Details</h2>
        {children}
      </div>
    </div>
  );
}
