'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

export function ReportDisclaimer() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-muted rounded-lg p-3">
      <div className="flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <p>
            This report is for informational purposes only. Data is sourced from NZ government
            agencies and may not reflect current conditions.{' '}
            {!expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="text-piq-primary underline underline-offset-2 hover:no-underline font-medium"
              >
                Read full disclaimer
              </button>
            )}
          </p>
          {expanded && (
            <p className="mt-2">
              Risk scores are indicative estimates based on publicly available data and should not
              be relied upon for financial, legal, or insurance decisions. Property valuations are
              council rateable values, not market valuations. Always obtain professional advice
              before making property decisions. WhareScore is not liable for any loss arising from
              use of this information.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
