'use client';

import { useState, useCallback, useEffect } from 'react';
import { Drawer } from 'vaul';
import { useMobileBackButton } from '@/hooks/useMobileBackButton';

// 3 snap points: peek (search + feature chips visible), half (summary visible), full (full report)
const SNAP_POINTS = ['220px', '55%', 1] as const;

interface MobileDrawerProps {
  children: React.ReactNode;
  /** Whether a property is selected — controls initial snap position */
  hasSelection?: boolean;
}

export function MobileDrawer({ children, hasSelection = false }: MobileDrawerProps) {
  const [snap, setSnap] = useState<string | number | null>('220px');
  const { pushState, popState } = useMobileBackButton();

  // Force Vaul to remount when viewport height changes significantly
  // (orientation change, mobile toolbar show/hide, browser resize).
  // Vaul caches drawer height on mount and doesn't recalculate snap positions.
  const [drawerKey, setDrawerKey] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let prevHeight = window.innerHeight;
    const onResize = () => {
      const delta = Math.abs(window.innerHeight - prevHeight);
      if (delta > 50) {
        prevHeight = window.innerHeight;
        setDrawerKey((k) => k + 1);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // When a property is selected, auto-snap to half
  useEffect(() => {
    if (hasSelection) {
      setSnap('55%');
    } else {
      setSnap('220px');
    }
  }, [hasSelection]);

  const handleSnapChange = useCallback(
    (point: string | number | null) => {
      // Never allow dismiss (null snap)
      if (point === null) {
        setSnap('220px');
        return;
      }

      // Enforce sequential snapping: peek -> half -> full, never peek -> full directly
      if (snap === '220px' && point === 1) {
        setSnap('55%');
        pushState();
        return;
      }

      // Track navigation state for back button
      if (typeof point === 'number' && point === 1) {
        pushState();
      }

      setSnap(point);
    },
    [snap, pushState],
  );

  // Listen for "snap to full" events (e.g. from "Get Full Report" button)
  useEffect(() => {
    const handler = () => {
      setSnap(1);
      pushState();
    };
    window.addEventListener('drawer:snap-full', handler);
    return () => window.removeEventListener('drawer:snap-full', handler);
  }, [pushState]);

  // Handle system back button (mobile)
  useEffect(() => {
    const handlePopState = () => {
      if (snap === 1) {
        setSnap('55%');
      } else if (snap === '55%') {
        setSnap('220px');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [snap]);

  return (
    <Drawer.Root
      key={drawerKey}
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={snap}
      setActiveSnapPoint={handleSnapChange}
      fadeFromIndex={2}
      modal={false}
      open
      onOpenChange={(open) => {
        // Never allow the drawer to close
        if (!open) return;
      }}
      dismissible={false}
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-2xl bg-background border-t border-border shadow-[0_-4px_30px_rgba(0,0,0,0.1)]"
          style={{
            height: 'calc(100vh - 56px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          aria-label="Property information panel"
        >
          <Drawer.Title className="sr-only">Property Details</Drawer.Title>
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <Drawer.Handle className="h-1.5 w-12 rounded-full bg-muted-foreground/25" />
          </div>

          {/* Content — scrollable, grows to fill available snap height */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
