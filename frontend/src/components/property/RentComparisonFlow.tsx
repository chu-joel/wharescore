'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RentDistributionBar } from './RentDistributionBar';
import { formatRent } from '@/lib/format';
import { apiFetch } from '@/lib/api';
import { useRentInputStore } from '@/stores/rentInputStore';
import type { MarketData, PropertyDetection, RentAssessment } from '@/lib/types';

interface RentComparisonFlowProps {
  addressId: number;
  market: MarketData;
  detection: PropertyDetection | null;
}

type DwellingType = 'House' | 'Flat' | 'Apartment' | 'Room';
type Bedrooms = '1' | '2' | '3' | '4' | '5+';

const DWELLING_TYPES: DwellingType[] = ['House', 'Flat', 'Apartment', 'Room'];
const BEDROOM_OPTIONS: Bedrooms[] = ['1', '2', '3', '4', '5+'];

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
  const [contributeChecked, setContributeChecked] = useState(true);
  const sentRef = useRef(false);

  const rentValue = parseInt(rentInput, 10);
  const rentValid = !isNaN(rentValue) && rentValue >= 50 && rentValue <= 5000;

  // Refs for unmount cleanup — captures latest values without stale closures
  const contributeRef = useRef(contributeChecked);
  const dwellingTypeRef = useRef(dwellingType);
  const bedroomsRef = useRef(bedrooms);
  const rentValueRef = useRef(rentValue);
  const rentValidRef = useRef(rentValid);
  contributeRef.current = contributeChecked;
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

  useEffect(() => {
    setStoreRent(rentValid ? rentValue : null);
  }, [rentValid, rentValue, setStoreRent]);

  const rentOutOfBounds = rentInput.length > 0 && !isNaN(rentValue) && (rentValue < 50 || rentValue > 5000);
  const canCompare = dwellingType && bedrooms && (rentInput === '' || rentValid);

  // Handle rent input — strip non-digits
  const handleRentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    setRentInput(cleaned);
    setError(null);
  };

  const handleCompare = useCallback(async () => {
    if (!dwellingType || !bedrooms) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        dwelling_type: dwellingType,
        bedrooms,
        ...(rentValid && { asking_rent: String(rentValue) }),
      });
      const result = await apiFetch<{ rent_assessment: RentAssessment }>(
        `/api/v1/property/${addressId}/market?${params}`
      );
      setAssessment(result.rent_assessment);
    } catch {
      setError('Could not load market data. Try again.');
    } finally {
      setLoading(false);
    }
  }, [addressId, dwellingType, bedrooms, rentValid, rentValue]);

  // Fire-and-forget rent report on unmount
  useEffect(() => {
    return () => {
      if (
        contributeRef.current &&
        rentValidRef.current &&
        dwellingTypeRef.current &&
        bedroomsRef.current &&
        !sentRef.current
      ) {
        sentRef.current = true;
        const body = JSON.stringify({
          address_id: addressId,
          dwelling_type: dwellingTypeRef.current,
          bedrooms: bedroomsRef.current,
          reported_rent: rentValueRef.current,
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
          {DWELLING_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setDwellingType(type)}
              className={`rounded-full h-9 px-4 text-sm font-medium border transition-colors ${
                dwellingType === type
                  ? 'bg-piq-primary text-white border-piq-primary'
                  : 'border-piq-primary text-piq-primary hover:bg-piq-primary/5'
              }`}
            >
              {type}
              {detection?.detected_type === type.toLowerCase() && (
                <span className="text-[10px] ml-1 opacity-70">(detected)</span>
              )}
            </button>
          ))}
        </div>
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
        <p className="text-xs text-muted-foreground mb-1.5">Your weekly rent (optional)</p>
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

      {/* Compare Button */}
      <Button
        onClick={handleCompare}
        disabled={!canCompare || loading}
        className="w-full"
      >
        {loading ? 'Comparing...' : 'Compare'}
      </Button>

      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      {/* Assessment Results */}
      {assessment && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Rental Market</span>
              <Badge variant="secondary" className="text-[10px]">
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
            />

            {rentValid && assessment.user_percentile !== null && (
              <div className="mt-3 p-2 rounded-lg bg-muted">
                <p className="text-sm font-medium text-center">
                  {assessment.user_percentile <= 25
                    ? 'Your rent looks below average — good value!'
                    : assessment.user_percentile <= 75
                      ? 'Your rent is around the median for this area.'
                      : 'Your rent is above average for this area.'}
                </p>
              </div>
            )}
          </div>

          {/* Contribution checkbox */}
          {rentValid && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={contributeChecked}
                onChange={(e) => setContributeChecked(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <span>
                Help others — anonymously contribute your rent to community data.
                Your rent won&apos;t be linked to your identity.
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
