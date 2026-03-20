'use client';

import { useSyncExternalStore } from 'react';

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 640) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

let listeners: Array<() => void> = [];
let current: Breakpoint = getBreakpoint();

function subscribe(cb: () => void) {
  listeners.push(cb);
  if (listeners.length === 1) {
    window.addEventListener('resize', onResize);
  }
  return () => {
    listeners = listeners.filter((l) => l !== cb);
    if (listeners.length === 0) {
      window.removeEventListener('resize', onResize);
    }
  };
}

function onResize() {
  const next = getBreakpoint();
  if (next !== current) {
    current = next;
    listeners.forEach((cb) => cb());
  }
}

function getSnapshot(): Breakpoint {
  return current;
}

function getServerSnapshot(): Breakpoint {
  return 'desktop';
}

export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
