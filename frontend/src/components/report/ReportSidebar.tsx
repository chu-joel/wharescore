'use client';

import { useHostedReportStore } from '@/stores/hostedReportStore';
import { RentBandGauge } from '@/components/property/RentBandGauge';
import type { ReportSnapshot } from '@/lib/types';

interface ReportSidebarProps {
  snapshot: ReportSnapshot;
  rentBand: ReturnType<typeof import('@/stores/hostedReportStore').computeRentBand>;
}

const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5+'];
const BATHROOM_OPTIONS = ['1', '2', '3+'];
const FINISH_TIERS = [
  { value: 'basic', label: 'Basic', desc: 'Dated kitchen/bathroom' },
  { value: 'standard', label: 'Standard', desc: 'Clean, no frills' },
  { value: 'modern', label: 'Modern', desc: 'Recently renovated' },
  { value: 'premium', label: 'Premium', desc: 'High-end finishes' },
  { value: 'luxury', label: 'Luxury', desc: 'Architect-designed' },
];

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${
        selected
          ? 'bg-piq-primary text-white border-piq-primary shadow-sm'
          : 'border-border text-foreground hover:border-piq-primary hover:text-piq-primary'
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        <Pill selected={value === true} onClick={() => onChange(true)}>Yes</Pill>
        <Pill selected={value === false} onClick={() => onChange(false)}>No</Pill>
      </div>
    </div>
  );
}

const VERDICT_LABELS: Record<string, { text: string; color: string }> = {
  'below-market': { text: 'Below market', color: 'text-piq-success' },
  'fair': { text: 'Fair', color: 'text-piq-success' },
  'slightly-high': { text: 'Slightly high', color: 'text-yellow-600' },
  'high': { text: 'High', color: 'text-risk-high' },
  'very-high': { text: 'Very high', color: 'text-risk-high' },
};

export function ReportSidebar({ snapshot, rentBand }: ReportSidebarProps) {
  const store = useHostedReportStore();
  const persona = snapshot.meta.persona;
  const selectedFinish = FINISH_TIERS.find(t => t.value === store.finishTier);

  return (
    <div className="p-4 space-y-5">
      <div>
        <h3 className="text-sm font-bold mb-1">Adjust property details</h3>
        <p className="text-xs text-muted-foreground">Change inputs to see how the analysis updates.</p>
      </div>

      {/* Bedrooms */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Bedrooms</label>
        <div className="flex flex-wrap gap-1.5">
          {BEDROOM_OPTIONS.map((b) => (
            <Pill key={b} selected={store.bedrooms === b} onClick={() => store.setBedrooms(b)}>
              {b}
            </Pill>
          ))}
        </div>
      </div>

      {/* Bathrooms */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Bathrooms</label>
        <div className="flex flex-wrap gap-1.5">
          {BATHROOM_OPTIONS.map((b) => (
            <Pill key={b} selected={store.bathrooms === b} onClick={() => store.setBathrooms(b)}>
              {b}
            </Pill>
          ))}
        </div>
      </div>

      {/* Finish tier */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Condition</label>
        <div className="flex flex-wrap gap-1.5">
          {FINISH_TIERS.map((t) => (
            <Pill key={t.value} selected={store.finishTier === t.value} onClick={() => store.setFinishTier(t.value)}>
              {t.label}
            </Pill>
          ))}
        </div>
        {selectedFinish && (
          <p className="text-xs text-muted-foreground mt-1 italic">{selectedFinish.desc}</p>
        )}
      </div>

      {/* Toggles — persona-aware */}
      <div className="space-y-2">
        <Toggle label="Parking?" value={store.hasParking} onChange={store.setHasParking} />
        <Toggle label="Outdoor space?" value={store.hasOutdoorSpace} onChange={store.setHasOutdoorSpace} />
        <Toggle label="Character property?" value={store.isCharacterProperty} onChange={store.setIsCharacterProperty} />
        {persona === 'renter' && (
          <>
            <Toggle label="Furnished?" value={store.isFurnished} onChange={store.setIsFurnished} />
            <Toggle label="Partially furnished?" value={store.isPartiallyFurnished} onChange={store.setIsPartiallyFurnished} />
            <Toggle label="Not insulated?" value={store.notInsulated} onChange={store.setNotInsulated} />
            {(snapshot.meta.dwelling_type === 'Room' || snapshot.meta.dwelling_type === 'Flat') && (
              <Toggle label="Shared kitchen?" value={store.sharedKitchen} onChange={store.setSharedKitchen} />
            )}
            <Toggle label="Utilities included?" value={store.utilitiesIncluded} onChange={store.setUtilitiesIncluded} />
          </>
        )}
      </div>

      {/* Rent input (renter) / Asking price (buyer) */}
      {persona === 'renter' ? (
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Your weekly rent</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
            <input
              type="number"
              value={store.weeklyRent ?? ''}
              onChange={(e) => store.setWeeklyRent(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g. 550"
              className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-base tabular-nums focus:border-piq-primary focus:ring-1 focus:ring-piq-primary/30 outline-none"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Asking / purchase price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
            <input
              type="number"
              value={store.askingPrice ?? ''}
              onChange={(e) => store.setAskingPrice(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g. 850000"
              className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-base tabular-nums focus:border-piq-primary focus:ring-1 focus:ring-piq-primary/30 outline-none"
            />
          </div>
        </div>
      )}

      {/* Live result — renter: rent band, buyer: price estimate */}
      {persona === 'renter' && rentBand.baseline && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Fair rent range</p>
            <p className="text-lg font-bold tabular-nums text-piq-primary">
              ${rentBand.bandLow}–${rentBand.bandHigh}/wk
            </p>
          </div>

          <RentBandGauge
            bandLow={rentBand.bandLow}
            bandHigh={rentBand.bandHigh}
            bandLowOuter={rentBand.bandLowOuter}
            bandHighOuter={rentBand.bandHighOuter}
            userRent={store.weeklyRent ?? 0}
            rawMedian={rentBand.baseline.raw_median}
          />

          {rentBand.verdict && (
            <div className={`text-center text-sm font-semibold ${VERDICT_LABELS[rentBand.verdict]?.color ?? ''}`}>
              {VERDICT_LABELS[rentBand.verdict]?.text}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            {rentBand.baseline.bond_count} bonds · {snapshot.meta.sa2_name}
          </p>
        </div>
      )}

      {persona === 'buyer' && (
        <div className="space-y-3">
          {/* Expected rent — dynamic, updates with sidebar inputs */}
          {rentBand.baseline && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Expected rent</p>
                <p className="text-lg font-bold tabular-nums text-piq-primary">
                  ${rentBand.bandLow}–${rentBand.bandHigh}/wk
                </p>
                <p className="text-xs text-muted-foreground">
                  {store.bedrooms}-bed {snapshot.meta.dwelling_type.toLowerCase()} · {rentBand.baseline.bond_count} bonds
                </p>
              </div>
              {store.askingPrice && rentBand.bandLow > 0 && (
                <div className="text-center pt-1 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">Gross yield</p>
                  <p className="text-sm font-bold tabular-nums">
                    {(((rentBand.bandLow + rentBand.bandHigh) / 2 * 52 / store.askingPrice) * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Price estimate — fixed from snapshot */}
          {snapshot.price_advisor && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Estimated value</p>
                <p className="text-lg font-bold tabular-nums text-piq-primary">
                  ${(snapshot.price_advisor.estimated_value / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-muted-foreground">
                  ${(snapshot.price_advisor.band_low / 1000).toFixed(0)}K – ${(snapshot.price_advisor.band_high / 1000).toFixed(0)}K
                </p>
              </div>
              {snapshot.price_advisor.hazard_count > 0 && (
                <p className="text-xs text-center text-risk-high font-medium">
                  {snapshot.price_advisor.hazard_count} hazard flag{snapshot.price_advisor.hazard_count > 1 ? 's' : ''} detected
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
