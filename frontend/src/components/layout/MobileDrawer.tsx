'use client';

import { useState, useCallback, useEffect } from 'react';
import { Drawer } from 'vaul';
import { useMobileBackButton } from '@/hooks/useMobileBackButton';

// 3 snap points: peek (search bar visible), half (summary visible), full (full report)
const SNAP_POINTS = ['148px', '55%', 1] as const;

interface MobileDrawerProps {
  children: React.ReactNode;
  /** Whether a property is selected — controls initial snap position */
  hasSelection?: boolean;
}

export function MobileDrawer({ children, hasSelection = false }: MobileDrawerProps) {
  const [snap, setSnap] = useState<string | number | null>('148px');
  const { pushState, popState } = useMobileBackButton();

  // When a property is selected, auto-snap to half
  useEffect(() => {
    if (hasSelection) {
      setSnap('55%');
    } else {
      setSnap('148px');
    }
  }, [hasSelection]);

  const handleSnapChange = useCallback(
    (point: string | number | null) => {
      // Enforce sequential snapping: peek -> half -> full, never peek -> full directly
      if (snap === '148px' && point === 1) {
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

  // Handle system back button (mobile)
  useEffect(() => {
    const handlePopState = () => {
      if (snap === 1) {
        setSnap('55%');
      } else if (snap === '55%') {
        setSnap('148px');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [snap]);

  return (
    <Drawer.Root
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={snap}
      setActiveSnapPoint={handleSnapChange}
      modal={false}
      open
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl bg-background border-t border-border shadow-[0_-4px_30px_rgba(0,0,0,0.1)]"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          aria-label="Property information panel"
        >
          <Drawer.Title className="sr-only">Property Details</Drawer.Title>
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1">
            <Drawer.Handle className="h-1.5 w-12 rounded-full bg-muted-foreground/25" />
          </div>

          {/* Content */}
          <div
            className="overflow-y-auto overscroll-contain px-4 pb-4"
            style={{
              maxHeight: snap === 1 ? 'calc(100vh - 80px)' : snap === '55%' ? 'calc(55vh - 40px)' : '108px',
            }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
