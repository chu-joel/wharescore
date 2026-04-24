'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RentDistributionBar } from './RentDistributionBar';
import { formatRent } from '@/lib/format';
import { apiFetch } from '@/lib/api';
import { useRentInputStore } from '@/stores/rentInputStore';
import { useBudgetStore } from '@/stores/budgetStore';
import type { MarketData, PropertyDetection, RentAssessment } from '@/lib/types';

interface RentComparisonFlowProps {
  addressId: number;
  market: MarketData;
  detection: PropertyDetection | null;
}

type DwellingType = 'House' | 'Flat' | 'Apartment' | 'Room';
type Bedrooms = 'Studio' | '1' | '2' | '3' | '4' | '5+';

const DWELLING_TYPES: { value: DwellingType; description: string }[] = [
  { value: 'House', description: 'Standalone house, townhouse, or unit with its own entrance' },
  { value: 'Flat', description: 'Part of a converted house or small block (2–4 units)' },
  { value: 'Apartment', description: 'Purpose-built apartment building (5+ units)' },
  { value: 'Room', description: 'Single room in a shared house or flatting situation' },
];
const BEDROOM_OPTIONS: Bedrooms[] = ['Studio', '1', '2', '3', '4', '5+'];

export function RentComparisonFlow({ addressId, market, detection }: RentComparisonFlowProps) {
  const [dwellingType, setDwellingType] = useState<DwellingType | null>(
    (detection?.detected_type as DwellingType) ?? null
  );
  const [bedrooms, setBedrooms] = useState<Bedrooms | null>(
    detection?.detected_bedrooms ? (String(detection.detected_bedrooms) as Bedrooms) : null
  );
  const [rentInput, setRentInput] = useState('');
  const [assessment, setAssessment] = useState<RentAssessment | null>(market.rent_assessment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dedup: skip re-sending the same (dwelling, bedrooms, rent) tuple. The
  // backend upserts within the 24h window so multiple POSTs are safe,
  // but there's no point spamming.
  const lastSentKeyRef = useRef<string>('');

  const rentValue = parseInt(rentInput, 10);
  const rentValid = !isNaN(rentValue) && rentValue >= 50 && rentValue <= 5000;

  // Refs for unmount cleanup. captures latest values without stale closures
  const dwellingTypeRef = useRef(dwellingType);
  const bedroomsRef = useRef(bedrooms);
  const rentValueRef = useRef(rentValue);
  const rentValidRef = useRef(rentValid);
  dwellingTypeRef.current = dwellingType;
  bedroomsRef.current = bedrooms;
  rentValueRef.current = rentValue;
  rentValidRef.current = rentValid;
  // Sync to shared store so RentAdvisorCard can read these values
  const setStoreDwelling = useRentInputStore((s) => s.setDwellingType);
  const setStoreBedrooms = useRentInputStore((s) => s.setBedrooms);
  const setStoreRent = useRentInputStore((s) => s.setWeeklyRent);

  useEffect(() => {
    if (dwellingType) setStoreDwelling(dwellingType);
  }, [dwellingType, setStoreDwelling]);

  useEffect(() => {
    if (bedrooms) setStoreBedrooms(bedrooms);
  }, [bedrooms, setStoreBedrooms]);

  const updateBudgetRenter = useBudgetStore((s) => s.updateRenter);

  useEffect(() => {
    setStoreRent(rentValid ? rentValue : null);
    // Sync to budget calculator too
    if (rentValid) {
      updateBudgetRenter(addressId, { weeklyRent: rentValue });
    }
  }, [rentValid, rentValue, setStoreRent, updateBudgetRenter, addressId]);

  // Sync dwelling type to budget calculator (room = different cost model)
  useEffect(() => {
    if (dwellingType) {
      updateBudgetRenter(addressId, { roomOnly: dwellingType === 'Room' });
    }
  }, [dwellingType, updateBudgetRenter, addressId]);

  const rentOutOfBounds = rentInput.length > 0 && !isNaN(rentValue) && (rentValue < 50 || rentValue > 5000);

  // Handle rent input. strip non-digits
  const handleRentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    setRentInput(cleaned);
    setError(null);
  };

  // Auto-fetch when dwelling type or bedrooms change
  useEffect(() => {
    if (!dwellingType || !bedrooms) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Studio maps to 1-bed in bond data (MBIE has no studio category)
    const bondBedrooms = bedrooms === 'Studio' ? '1' : bedrooms;
    const params = new URLSearchParams({
      dwelling_type: dwellingType,
      bedrooms: bondBedrooms,
      ...(rentValid && { asking_rent: String(rentValue) }),
    });
    apiFetch<{ rent_assessment: RentAssessment }>(
      `/api/v1/property/${addressId}/market?${params}`
    )
      .then((result) => {
        if (!cancelled) setAssessment(result.rent_assessment);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load market data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [addressId, dwellingType, bedrooms, rentValid, rentValue]);

  // Submit the user's rent to /rent-reports whenever the three core fields
  // are valid, debounced 1s after the last change. Backend upserts within
  // a 24h window so multiple submissions progressively enrich one row
  // rather than creating duplicates. Data collection is covered by the
  // RentDataNotice banner — we do not gate on a per-form checkbox.
  useEffect(() => {
    if (!rentValid || !dwellingType || !bedrooms) return;
    // Studio maps to 1-bed for bond comparison (MBIE has no studio cat).
    const bondBedrooms = bedrooms === 'Studio' ? '1' : bedrooms;
    const key = `${dwellingType}|${bondBedrooms}|${rentValue}`;
    if (lastSentKeyRef.current === key) return;

    const timer = setTimeout(() => {
      lastSentKeyRef.current = key;
      apiFetch('/api/v1/rent-reports', {
        method: 'POST',
        body: JSON.stringify({
          address_id: addressId,
          dwelling_type: dwellingType,
          bedrooms: bondBedrooms,
          reported_rent: rentValue,
          source_context: 'rent_comparison_flow',
          notice_version:
            (typeof window !== 'undefined' &&
              window.localStorage?.getItem('ws_rent_notice_seen')?.replace(/"/g, '')) ||
            null,
        }),
      }).catch(() => {
        // Non-fatal — let user retry on next edit.
        lastSentKeyRef.current = '';
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [addressId, dwellingType, bedrooms, rentValue, rentValid]);

  // Backup: if the user navigates away before the 1s debounce fires (e.g.
  // types their rent and immediately closes the tab) send a beacon so the
  // submission isn't lost.
  useEffect(() => {
    return () => {
      if (
        rentValidRef.current &&
        dwellingTypeRef.current &&
        bedroomsRef.current
      ) {
        const bondBedrooms = bedroomsRef.current === 'Studio' ? '1' : bedroomsRef.current;
        const key = `${dwellingTypeRef.current}|${bondBedrooms}|${rentValueRef.current}`;
        if (lastSentKeyRef.current === key) return;
        const body = JSON.stringify({
          address_id: addressId,
          dwelling_type: dwellingTypeRef.current,
          bedrooms: bondBedrooms,
          reported_rent: rentValueRef.current,
          source_context: 'rent_comparison_flow_unmount',
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/v1/rent-reports',
            new Blob([body], { type: 'application/json' })
          );
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {/* Property Type Selector */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Property type</p>
        <div className="flex flex-wrap gap-1.5">
          {DWELLING_TYPES.map(({ value, description }) => (
            <button
              key={value}
              onClick={() => setDwellingType(value)}
              className={`rounded-full h-9 px-4 text-sm font-medium border transition-colors ${
                dwellingType === value
                  ? 'bg-piq-primary text-white border-piq-primary'
                  : 'border-piq-primary text-piq-primary hover:bg-piq-primary/5'
              }`}
              title={description}
            >
              {value}
              {detection?.detected_type === value.toLowerCase() && (
                <span className="text-xs ml-1 opacity-70">(detected)</span>
              )}
            </button>
          ))}
        </div>
        {dwellingType && (
          <p className="text-xs text-muted-foreground mt-1.5 italic">
            {DWELLING_TYPES.find((t) => t.value === dwellingType)?.description}
          </p>
        )}
      </div>

      {/* Bedroom Selector */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Bedrooms</p>
        <div className="flex flex-wrap gap-1.5">
          {BEDROOM_OPTIONS.map((bed) => (
            <button
              key={bed}
              onClick={() => setBedrooms(bed)}
              className={`rounded-full h-9 px-4 text-sm font-medium border transition-colors ${
                bedrooms === bed
                  ? 'bg-piq-primary text-white border-piq-primary'
                  : 'border-piq-primary text-piq-primary hover:bg-piq-primary/5'
              }`}
            >
              {bed}
            </button>
          ))}
        </div>
      </div>

      {/* Rent Input */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Your weekly rent</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 580"
              value={rentInput}
              onChange={handleRentChange}
              className="pl-7"
            />
          </div>
          <span className="self-center text-sm text-muted-foreground">/week</span>
        </div>
        {rentOutOfBounds && (
          <p className="text-xs text-destructive mt-1">
            NZ rents are typically $100–$2,000/week.
          </p>
        )}
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground text-center">Loading market data...</p>
      )}

      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      {/* Assessment Results */}
      {assessment && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Rental Market</span>
              <Badge variant="secondary" className="text-xs">
                {assessment.bond_count} bonds
              </Badge>
            </div>

            <RentDistributionBar
              lowerQuartile={assessment.lower_quartile}
              median={assessment.median}
              upperQuartile={assessment.upper_quartile}
              userRent={rentValid ? rentValue : undefined}
              confidence={assessment.confidence_stars}
              userPercentile={assessment.user_percentile}
              bondCount={assessment.bond_count}
            />

            {rentValid && assessment.user_percentile !== null && (
              <div className="mt-3 p-2 rounded-lg bg-muted">
                <p className="text-sm font-medium text-center">
                  {assessment.user_percentile <= 25
                    ? 'Your rent looks below average. good value!'
                    : assessment.user_percentile <= 75
                      ? 'Your rent is around the median for this area.'
                      : 'Your rent is above average for this area.'}
                </p>
              </div>
            )}
          </div>

          {/* No opt-in checkbox — data collection is covered by the
              first-visit RentDataNotice banner. See
              components/common/RentDataNotice.tsx. */}
        </div>
      )}
    </div>
  );
}
