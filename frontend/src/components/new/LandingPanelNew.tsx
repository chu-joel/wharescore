'use client';

import { ShieldAlert, TreePine, TrendingUp, Search, MapPin, MousePointerClick } from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { useSearchStore } from '@/stores/searchStore';
import { useMapStore } from '@/stores/mapStore';
import { apiFetch } from '@/lib/api';
import { Card, CardHead, CardBody } from '@/components/new/ui/primitives';

const DEMO = [
  { label: 'Ponsonby, Auckland', q: '100 Ponsonby Road, Auckland' },
  { label: 'Wellington CBD', q: '10 Customhouse Quay, Wellington' },
  { label: 'Christchurch CBD', q: '100 Cashel Street, Christchurch' },
];

export function LandingPanelNew() {
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const selectProperty = useMapStore((s) => s.selectProperty);

  const pick = async (q: string) => {
    try {
      const res = await apiFetch<{ results?: { address_id: number; full_address: string; lng: number; lat: number }[] }>(
        `/api/v1/search/address?q=${encodeURIComponent(q)}`,
      );
      const first = res.results?.[0];
      if (!first) return;
      selectAddress({ addressId: first.address_id, fullAddress: first.full_address, lng: first.lng, lat: first.lat });
      selectProperty(first.address_id, first.lng, first.lat);
    } catch { /* non-critical */ }
  };

  return (
    <div style={{ padding: '32px 24px 56px', display: 'grid', gap: 16 }}>
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div
          aria-hidden
          style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(13,115,119,.12)',
            color: 'var(--ws-piq-dark)',
            display: 'grid', placeItems: 'center',
            margin: '0 auto 12px',
          }}
        >
          <MapPin size={22} />
        </div>
        <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ws-ink)' }}>
          Whare<span style={{ color: 'var(--ws-piq)' }}>Score</span>
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ws-ink-soft)' }}>Everything the listing doesn&rsquo;t tell you.</p>
      </div>

      <div><SearchBar /></div>
      <p style={{
        textAlign: 'center', margin: 0, fontSize: 12,
        color: 'var(--ws-ink-mute)',
        display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
      }}>
        <MousePointerClick size={13} /> Or click any property on the map.
      </p>

      <div>
        <div style={{ fontSize: 11.5, color: 'var(--ws-ink-mute)', marginBottom: 8, letterSpacing: '0.04em' }}>Or try a sample</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DEMO.map((d) => (
            <button
              key={d.q}
              onClick={() => pick(d.q)}
              className="ws-btn ws-btn-outline"
              style={{ borderRadius: 999, fontSize: 12, padding: '6px 12px', minHeight: 32 }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHead title="What WhareScore covers" meta="40+ data sources" />
        <CardBody>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' }}>
            <Feature icon={<ShieldAlert size={16} color="var(--ws-r-vhigh)" />} label="Hazards" detail="Flood, tsunami, quake, EPB, liquefaction" />
            <Feature icon={<TreePine size={16} color="var(--ws-success)" />} label="Liveability" detail="Schools, crime, NZDep, parks, GPs" />
            <Feature icon={<TrendingUp size={16} color="var(--ws-piq)" />} label="Market" detail="Rent advisor, price advisor, HPI" />
            <Feature icon={<Search size={16} color="var(--ws-warm)" />} label="Planning" detail="Zoning, heritage, viewshafts, consents" />
          </div>
        </CardBody>
      </Card>

      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)', textAlign: 'center' }}>
        Powered by 40+ official NZ government data sources. Free preview for every address.
      </p>
    </div>
  );
}

function Feature({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 10, alignItems: 'start' }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ws-ink)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--ws-ink-soft)' }}>{detail}</div>
      </div>
    </div>
  );
}
