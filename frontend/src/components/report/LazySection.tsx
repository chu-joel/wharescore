'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';

interface LazySectionProps {
  children: ReactNode;
  /** Vertical margin around the element to trigger loading before it enters viewport */
  rootMargin?: string;
  /** Minimum height placeholder before content loads */
  minHeight?: number;
}

/**
 * Renders children only when the section is near the viewport.
 * Uses IntersectionObserver with a generous rootMargin so content
 * loads before the user scrolls to it (no visible pop-in).
 */
export function LazySection({ children, rootMargin = '400px 0px', minHeight = 80 }: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}
