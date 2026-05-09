'use client';

import { Shield } from 'lucide-react';
import { useSession } from 'next-auth/react';

/**
 * Free-tier nudge for anonymous users. Hidden once authenticated.
 */
export function BetaBannerNew() {
  const { status } = useSession();
  if (status === 'authenticated') return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      borderRadius: 'var(--ws-radius)',
      border: '1px solid rgba(13,115,119,.15)',
      background: 'rgba(13,115,119,.04)',
      padding: '10px 14px',
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 'var(--ws-radius-sm)',
        background: 'rgba(13,115,119,.10)', color: 'var(--ws-piq)',
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        <Shield size={14} />
      </span>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ws-ink)' }}>
        <strong style={{ color: 'var(--ws-piq-dark)', fontWeight: 600 }}>Free property report. sign in for the full version.</strong>
      </p>
    </div>
  );
}
