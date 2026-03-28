import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

export function useTrackPageView(properties?: Record<string, unknown>) {
  const pathname = usePathname();
  useEffect(() => {
    trackEvent('page_view', { path: pathname, ...properties });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
}
