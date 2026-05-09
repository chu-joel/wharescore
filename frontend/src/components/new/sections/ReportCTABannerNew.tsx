'use client';

import { Download, AlertTriangle, Home, DollarSign, Bus, Map, Sparkles, Loader2, Shield, BookmarkPlus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { usePdfExport } from '@/hooks/usePdfExport';
import { usePersonaStore } from '@/stores/personaStore';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { formatCompactCurrency } from '@/lib/format';
import { Card } from '@/components/new/ui/primitives';
import { SocialProofNew } from './SocialProofNew';

interface Props {
  addressId: number;
  suburbName?: string;
  capitalValue?: number | null;
  medianRent?: number | null;
}

const BUYER_CONTENTS = [
  { Icon: AlertTriangle, label: 'Flood, earthquake & tsunami risk' },
  { Icon: Home,          label: 'Neighbourhood & crime score' },
  { Icon: DollarSign,    label: 'Investment yield & cost analysis' },
  { Icon: Bus,           label: 'Full commute times & walkability' },
  { Icon: Map,           label: 'Zoning, height limits & consents' },
  { Icon: Sparkles,      label: 'AI-generated property summary' },
];
const RENTER_CONTENTS = [
  { Icon: AlertTriangle, label: 'Flood, earthquake & safety risks' },
  { Icon: Home,          label: 'Neighbourhood & crime score' },
  { Icon: DollarSign,    label: 'Fair rent check & market trends' },
  { Icon: Bus,           label: 'Full commute times & walkability' },
  { Icon: Map,           label: 'Healthy Homes & insulation checks' },
  { Icon: Sparkles,      label: 'AI-generated property summary' },
];

function getSubheadline(persona: 'buyer' | 'renter', price: string, capitalValue?: number | null, medianRent?: number | null): string {
  if (persona === 'renter') {
    if (medianRent) return `${price} before you commit to $${medianRent}/week`;
    return `${price} to know before you sign the lease`;
  }
  if (capitalValue && capitalValue >= 100_000) {
    return `${price} to protect a ${formatCompactCurrency(capitalValue)} decision`;
  }
  return `${price} to protect your biggest investment`;
}

/**
 * Final CTA banner. Same logic as classic ReportCTABanner: dual-CTA for
 * anonymous users (Quick free + Full paid), single CTA for signed-in users.
 * Drives `pdf.startExport(tier)` exactly like classic.
 */
export function ReportCTABannerNew({ addressId, suburbName, capitalValue, medianRent }: Props) {
  const persona = usePersonaStore((s) => s.persona);
  const isPro = useDownloadGateStore((s) => s.credits?.plan === 'pro');
  const fullPrice = '$2.99';
  const pdf = usePdfExport(addressId, persona);
  const contents = persona === 'renter' ? RENTER_CONTENTS : BUYER_CONTENTS;
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  void isPro;

  return (
    <Card>
      <div className="ws-card-body" style={{
        padding: 18,
        background: 'linear-gradient(180deg, rgba(13,115,119,.06), rgba(13,115,119,.02))',
        borderRadius: 'var(--ws-radius-lg)',
      }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <header>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--ws-piq)', marginBottom: 6,
            }}>
              Full Intelligence Report
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ws-ink)', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
              {persona === 'renter' ? "Everything the landlord won't tell you" : "Everything the listing doesn't tell you"}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ws-ink-soft)', marginTop: 4 }}>
              {getSubheadline(persona, fullPrice, capitalValue, medianRent)}
            </div>
          </header>

          <ul style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '6px 14px', listStyle: 'none', padding: 0, margin: 0,
          }}>
            {contents.map(({ Icon, label }) => (
              <li key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ws-ink-soft)' }}>
                <Icon size={14} style={{ color: 'var(--ws-piq)', opacity: 0.75 }} />
                <span>{label}</span>
              </li>
            ))}
          </ul>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => pdf.startExport('full')}
              disabled={pdf.isGenerating}
              className="ws-btn ws-btn-primary"
              style={{ width: '100%', justifyContent: 'center', minHeight: 44, fontSize: 14, fontWeight: 600 }}
            >
              {pdf.isGenerating ? (
                <><Loader2 size={16} className="animate-spin" /> Generating report…</>
              ) : (
                <><Download size={16} /> Generate Full Report. {fullPrice}</>
              )}
            </button>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <button
                type="button"
                onClick={() => pdf.startExport('quick')}
                disabled={pdf.isGenerating}
                className="ws-btn ws-btn-primary"
                style={{ width: '100%', justifyContent: 'center', minHeight: 44, fontSize: 14, fontWeight: 600 }}
              >
                {pdf.isGenerating ? (
                  <><Loader2 size={16} className="animate-spin" /> Saving report…</>
                ) : (
                  <><BookmarkPlus size={16} /> Save free report. sign in</>
                )}
              </button>
              <button
                type="button"
                onClick={() => pdf.startExport('full')}
                disabled={pdf.isGenerating}
                style={{
                  background: 'transparent', border: 0, padding: '6px 0',
                  fontSize: 12, color: 'var(--ws-ink-soft)',
                  textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer',
                }}
              >
                Or skip ahead. buy the Full Report ({fullPrice})
              </button>
            </div>
          )}

          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
            fontSize: 11.5, color: 'var(--ws-ink-mute)',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Shield size={11} /> Secure payment
            </span>
            <span>·</span>
            <span>40+ risk checks</span>
            <span>·</span>
            <span>Instant delivery</span>
          </div>

          {suburbName && (
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--ws-rule)' }}>
              <SocialProofNew suburbName={suburbName} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
