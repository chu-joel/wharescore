'use client';

import { createContext, useContext } from 'react';
import type { ReportSnapshot } from '@/lib/types';

interface HostedReportContextValue {
  /** True when rendering inside the hosted report page */
  isHosted: true;
  /** The full snapshot data */
  snapshot: ReportSnapshot;
}

const HostedReportContext = createContext<HostedReportContextValue | null>(null);

export function HostedReportProvider({
  snapshot,
  children,
}: {
  snapshot: ReportSnapshot;
  children: React.ReactNode;
}) {
  return (
    <HostedReportContext.Provider value={{ isHosted: true, snapshot }}>
      {children}
    </HostedReportContext.Provider>
  );
}

/**
 * Returns the hosted report context if inside a hosted report page.
 * Returns null if not (i.e., on the free web UI).
 * Components can use this to skip API calls when hosted.
 */
export function useHostedReport() {
  return useContext(HostedReportContext);
}
