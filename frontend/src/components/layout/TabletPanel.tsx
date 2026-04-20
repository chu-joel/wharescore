'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TabletPanelProps {
  children: React.ReactNode;
}

export function TabletPanel({ children }: TabletPanelProps) {
  const [open, setOpen] = useState(true);

  // Auto-open when children change (new property selected)
  useEffect(() => {
    setOpen(true);
  }, [children]);

  return (
    <>
      {/* Backdrop scrim when panel is open (tappable to close) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/10 z-20 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-14 right-0 bottom-0 w-[340px] bg-background border-l border-border z-30 overflow-y-auto overscroll-contain shadow-xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {children}
      </div>

      {/* Toggle button. visible edge when panel is closed */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed top-1/2 -translate-y-1/2 z-30 h-12 w-6 bg-background border border-border shadow-md flex items-center justify-center transition-all duration-300 ${
          open
            ? 'right-[340px] rounded-l-lg border-r-0'
            : 'right-0 rounded-l-lg'
        }`}
        aria-label={open ? 'Close report panel' : 'Open report panel'}
      >
        {open ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </>
  );
}
