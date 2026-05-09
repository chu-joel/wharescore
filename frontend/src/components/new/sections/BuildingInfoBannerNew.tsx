'use client';

import { useState } from 'react';
import { Info, ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { SiblingValuation } from '@/lib/types';

interface Props {
  unitCount: number;
  siblingValuations: SiblingValuation[] | null;
  currentValuationId: string | null;
}

const MAX_ROWS = 6;

/**
 * Multi-unit caveat — clarifies that risk & neighbourhood are building-wide
 * while CV/rates are per-unit (or estimated). Optional sibling-unit table.
 */
export function BuildingInfoBannerNew({ unitCount, siblingValuations, currentValuationId }: Props) {
  const [open, setOpen] = useState(false);
  const hasSiblings = siblingValuations && siblingValuations.length >= 2;
  const hasPerUnit = hasSiblings;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      borderRadius: 'var(--ws-radius)', padding: 12,
      background: 'rgba(13,115,119,.05)', border: '1px solid rgba(13,115,119,.15)',
    }}>
      <Info size={16} style={{ color: 'var(--ws-piq)', marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: 'var(--ws-ink)' }}>
          Unit in a {unitCount}-unit building
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.5 }}>
          {hasPerUnit
            ? 'Valuations and rates are for this unit. Risk and neighbourhood data covers the whole building.'
            : "Council records don't have a per-unit valuation for this address, so the CV shown is an estimate (building total ÷ units). Risk and neighbourhood data covers the whole building."}
        </p>

        {hasSiblings && (
          <>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'transparent', border: 0, padding: '6px 0', cursor: 'pointer',
                fontSize: 12, color: 'var(--ws-piq-dark)', fontWeight: 500,
                textDecoration: 'underline', textUnderlineOffset: 2,
              }}
            >
              Compare {siblingValuations!.length} units in this building
              <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
            </button>

            {open && (
              <div style={{
                marginTop: 8,
                borderRadius: 'var(--ws-radius-sm)',
                border: '1px solid var(--ws-rule)',
                overflow: 'hidden',
              }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-rule)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: 'var(--ws-ink-soft)' }}>Address</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500, color: 'var(--ws-ink-soft)' }}>CV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siblingValuations!.slice(0, MAX_ROWS).map((sv) => {
                      const current = sv.valuation_id === currentValuationId;
                      return (
                        <tr key={sv.valuation_id} style={{
                          background: current ? 'rgba(13,115,119,.08)' : 'transparent',
                          fontWeight: current ? 600 : 400,
                        }}>
                          <td style={{ padding: '4px 8px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sv.address}
                            {current && <span style={{ color: 'var(--ws-piq-dark)', marginLeft: 4 }}>(you)</span>}
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(sv.capital_value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {siblingValuations!.length > MAX_ROWS && (
                  <p style={{
                    margin: 0, padding: '6px 8px',
                    fontSize: 11.5, color: 'var(--ws-ink-mute)',
                    borderTop: '1px solid var(--ws-rule)',
                  }}>
                    {siblingValuations!.length - MAX_ROWS} more units. See full comparison below.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
