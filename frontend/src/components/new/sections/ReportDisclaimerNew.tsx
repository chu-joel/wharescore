'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

/**
 * Disclaimer footer in the new design system. Compact tinted block with
 * progressive disclosure for the long-form clauses.
 */
export function ReportDisclaimerNew() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: 'var(--ws-bg-2)',
      borderRadius: 'var(--ws-radius-sm)',
      border: '1px solid var(--ws-rule)',
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Info size={14} style={{ color: 'var(--ws-ink-mute)', marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 11.5, color: 'var(--ws-ink-mute)', lineHeight: 1.55 }}>
          <p style={{ margin: 0 }}>
            This report is for informational purposes only. Data is sourced from NZ government agencies and may not reflect current conditions.{' '}
            {!open && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                style={{
                  background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
                  color: 'var(--ws-piq)', textDecoration: 'underline',
                  textUnderlineOffset: 2, fontWeight: 500, fontSize: 'inherit',
                }}
              >
                Read full disclaimer
              </button>
            )}
          </p>
          {open && (
            <p style={{ margin: '8px 0 0' }}>
              Risk scores are indicative estimates based on publicly available data and should not be relied upon for financial, legal, or insurance decisions. Property valuations are council rateable values, not market valuations. Always obtain professional advice before making property decisions. WhareScore is not liable for any loss arising from use of this information.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
