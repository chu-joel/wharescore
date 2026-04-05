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
 * Mobile bottom-sheet drawer with 3 snap points:
 *   mini = ~80px  (just the handle bar + address hint)
 *   peek = 220px  (search bar + chips visible)
 *   full = 100%   (full report, scrollable)
 *
 * Swipe down: full → peek → mini
 * Swipe up:   mini → peek → full
 * Click property: → full
 * Back button:    → peek
 */

type SnapId = 'mini' | 'peek' | 'full';

const HEADER_HEIGHT = 56;

function snapToPx(id: SnapId, vh: number): number {
  const maxHeight = vh - HEADER_HEIGHT;
  switch (id) {
    case 'mini':
      return 80;
    case 'peek':
      return Math.min(220, maxHeight);
    case 'full':
      return maxHeight;
  }
}

const SNAP_ORDER: SnapId[] = ['mini', 'peek', 'full'];

interface MobileDrawerProps {
  children: ReactNode;
  hasSelection?: boolean;
}

export function MobileDrawer({ children, hasSelection = false }: MobileDrawerProps) {
  const [snapId, setSnapId] = useState<SnapId>('peek');
  const [vh, setVh] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // When a property is selected, always snap to full + reset scroll
  useEffect(() => {
    if (hasSelection) {
      if (contentRef.current) contentRef.current.scrollTop = 0;
      setSnapId('full');
    }
  }, [hasSelection]);

  // Listen for "snap to full" events
  useEffect(() => {
    const handler = () => {
      if (contentRef.current) contentRef.current.scrollTop = 0;
      setSnapId('full');
    };
    window.addEventListener('drawer:snap-full', handler);
    return () => window.removeEventListener('drawer:snap-full', handler);
  }, []);

  // Collapse to mini when user pans/zooms the map
  useEffect(() => {
    const handler = () => {
      setSnapId((prev) => prev === 'full' ? 'peek' : 'mini');
    };
    window.addEventListener('drawer:collapse', handler);
    return () => window.removeEventListener('drawer:collapse', handler);
  }, []);

  // Back button → go down one snap
  useEffect(() => {
    const handlePopState = () => {
      setSnapId((prev) => {
        const idx = SNAP_ORDER.indexOf(prev);
        return idx > 0 ? SNAP_ORDER[idx - 1] : prev;
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Drag handling
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const currentHeight = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);

  const visibleHeight = snapToPx(snapId, vh);
  const maxHeight = vh - HEADER_HEIGHT;

  // Reset scroll both immediately and after the 300ms height transition,
  // to prevent the browser from restoring a stale scroll position when
  // overflow switches from hidden→auto during the animation.
  const resetScrollAfterTransition = useCallback(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setTimeout(() => {
      if (contentRef.current) contentRef.current.scrollTop = 0;
    }, 320);
  }, []);

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

      const dy = startY.current - e.clientY;
      if (Math.abs(dy) > 5) hasMoved.current = true;

      let newHeight = startHeight.current + dy;
      const miniPx = snapToPx('mini', vh);
      newHeight = Math.max(miniPx, Math.min(maxHeight, newHeight));

      currentHeight.current = newHeight;
      sheetRef.current.style.height = `${newHeight}px`;
    },
    [vh, maxHeight],
  );

  const onPointerUp = useCallback(() => {
    if (!dragging.current || !sheetRef.current) return;
    dragging.current = false;

    sheetRef.current.style.transition = '';

    // Tap without drag — cycle upward: mini→peek→full, full→peek
    if (!hasMoved.current) {
      sheetRef.current.style.height = '';
      setSnapId((prev) => {
        const idx = SNAP_ORDER.indexOf(prev);
        return idx < SNAP_ORDER.length - 1 ? SNAP_ORDER[idx + 1] : 'peek';
      });
      // Reset scroll after transition completes to avoid race with overflow change
      resetScrollAfterTransition();
      return;
    }

    // Drag ended — find nearest snap point, biased by drag direction
    const h = currentHeight.current;
    const dragDelta = h - startHeight.current; // positive = dragged up

    let target: SnapId;
    if (Math.abs(dragDelta) > 60) {
      // Intentional drag — move one snap in the drag direction
      const currentIdx = SNAP_ORDER.indexOf(snapId);
      if (dragDelta > 0 && currentIdx < SNAP_ORDER.length - 1) {
        target = SNAP_ORDER[currentIdx + 1];
      } else if (dragDelta < 0 && currentIdx > 0) {
        target = SNAP_ORDER[currentIdx - 1];
      } else {
        target = snapId;
      }
    } else {
      // Small drag — snap to nearest
      const miniPx = snapToPx('mini', vh);
      const peekPx = snapToPx('peek', vh);
      const fullPx = snapToPx('full', vh);
      const dists: [SnapId, number][] = [
        ['mini', Math.abs(h - miniPx)],
        ['peek', Math.abs(h - peekPx)],
        ['full', Math.abs(h - fullPx)],
      ];
      target = dists.sort((a, b) => a[1] - b[1])[0][0];
    }

    // Set inline height to the target snap. If target === snapId, setSnapId
    // won't re-render, so clearing the style would leave the drawer stuck at
    // its natural content height. Setting it explicitly keeps it pinned.
    sheetRef.current.style.height = `${snapToPx(target, vh)}px`;
    setSnapId(target);

    // Reset scroll after transition completes to avoid race with overflow change
    resetScrollAfterTransition();
  }, [vh, snapId, resetScrollAfterTransition]);

  // Push history state when going to full
  useEffect(() => {
    if (snapId === 'full') {
      window.history.pushState({ drawer: 'full' }, '');
    }
  }, [snapId]);

  const stopPropagation = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-label="Property information panel"
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-background border-t border-border shadow-[0_-4px_30px_rgba(0,0,0,0.3)]"
      style={{
        height: `${visibleHeight}px`,
        transition: 'height 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      onTouchStart={stopPropagation}
      onTouchMove={stopPropagation}
      onTouchEnd={stopPropagation}
    >
      {/* Drag handle */}
      <div
        data-drawer-handle
        className="flex flex-col items-center pt-4 pb-4 shrink-0 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
      </div>

      {/* Scrollable content — hidden overflow when mini to prevent stuck scroll */}
      <div
        ref={contentRef}
        className={`flex-1 px-2 pb-3 ${snapId === 'mini' ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'}`}
        style={{ touchAction: snapId === 'mini' ? 'none' : 'pan-y' }}
      >
        <h2 className="sr-only">Property Details</h2>
        {children}
      </div>
    </div>
  );
}
