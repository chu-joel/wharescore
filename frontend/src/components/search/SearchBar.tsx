'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, MapPin, Map } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearchStore } from '@/stores/searchStore';
import { useMapStore } from '@/stores/mapStore';
import { useSearch } from '@/hooks/useSearch';
import { useSuburbSearch } from '@/hooks/useSuburbReport';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useRouter } from 'next/navigation';

const MAX_QUERY_LENGTH = 200;

interface SearchBarProps {
  compact?: boolean;
}

export function SearchBar({ compact = false }: SearchBarProps) {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const selectSuburb = useSearchStore((s) => s.selectSuburb);
  const selectProperty = useMapStore((s) => s.selectProperty);
  const setViewport = useMapStore((s) => s.setViewport);
  const bp = useBreakpoint();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { results: addressResults, isLoading: addressLoading } = useSearch(query);
  const { results: suburbResults, isLoading: suburbLoading } = useSuburbSearch(query);

  const isLoading = addressLoading || suburbLoading;
  const totalResults = suburbResults.length + addressResults.length;

  const handleSelectAddress = useCallback(
    (result: { address_id: number; full_address: string; lng: number; lat: number }) => {
      selectAddress({
        addressId: result.address_id,
        fullAddress: result.full_address,
        lng: result.lng,
        lat: result.lat,
      });
      selectProperty(result.address_id, result.lng, result.lat);
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [selectAddress, selectProperty]
  );

  const handleSelectSuburb = useCallback(
    (result: { sa2_code: string; sa2_name: string; ta_name: string; lng: number; lat: number }) => {
      setIsOpen(false);
      setActiveIndex(-1);
      if (bp === 'mobile') {
        // On mobile: fly the map to the suburb and show suburb info in the drawer
        selectSuburb({
          sa2Code: result.sa2_code,
          sa2Name: result.sa2_name,
          taName: result.ta_name,
          lng: result.lng,
          lat: result.lat,
        });
        setViewport({ longitude: result.lng, latitude: result.lat, zoom: 14 });
      } else {
        router.push(`/suburb/${result.sa2_code}`);
      }
    },
    [bp, router, selectSuburb, setViewport]
  );

  useEffect(() => {
    setIsOpen(query.length >= 2 && totalResults > 0);
    setActiveIndex(-1);
  }, [query, totalResults]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || totalResults === 0) {
      if (e.key === 'Escape') {
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < totalResults - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalResults - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < totalResults) {
          if (activeIndex < suburbResults.length) {
            handleSelectSuburb(suburbResults[activeIndex]);
          } else {
            handleSelectAddress(addressResults[activeIndex - suburbResults.length]);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.slice(0, MAX_QUERY_LENGTH);
    setQuery(value);
  }

  const listboxId = 'search-results-listbox';

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search address or suburb..."
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && totalResults > 0 && setIsOpen(true)}
          className={`pl-10 pr-10 rounded-lg bg-background shadow-sm ${
            compact ? 'h-9 text-sm' : 'h-12'
          }`}
          maxLength={MAX_QUERY_LENGTH}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          aria-autocomplete="list"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); setActiveIndex(-1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="fixed sm:absolute left-2 right-2 sm:left-0 sm:right-0 top-[3.75rem] sm:top-full mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
        >
          {isLoading && (
            <li className="px-4 py-3 text-sm text-muted-foreground" role="option" aria-selected={false}>Searching...</li>
          )}

          {/* Suburb results */}
          {suburbResults.length > 0 && (
            <>
              <li className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50" role="presentation">
                Suburbs
              </li>
              {suburbResults.map((r, i) => (
                <li
                  key={`suburb-${r.sa2_code}`}
                  id={`search-result-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => handleSelectSuburb(r)}
                  className={`w-full text-left px-4 py-2.5 cursor-pointer transition-colors text-sm border-b border-border last:border-0 flex items-center gap-3 ${
                    i === activeIndex ? 'bg-muted' : 'hover:bg-muted'
                  }`}
                >
                  <Map className="h-4 w-4 text-piq-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{r.sa2_name}</div>
                    <div className="text-xs text-muted-foreground">{r.ta_name}</div>
                  </div>
                </li>
              ))}
            </>
          )}

          {/* Address results */}
          {addressResults.length > 0 && (
            <>
              {suburbResults.length > 0 && (
                <li className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50" role="presentation">
                  Addresses
                </li>
              )}
              {addressResults.map((r, i) => {
                const idx = suburbResults.length + i;
                return (
                  <li
                    key={r.address_id}
                    id={`search-result-${idx}`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    onClick={() => handleSelectAddress(r)}
                    className={`w-full text-left px-4 py-2.5 cursor-pointer transition-colors text-sm border-b border-border last:border-0 flex items-center gap-3 ${
                      idx === activeIndex ? 'bg-muted' : 'hover:bg-muted'
                    }`}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">{r.full_address}</div>
                      {(r.suburb || r.city) && (
                        <div className="text-xs text-muted-foreground">{[r.suburb, r.city].filter(Boolean).join(', ')}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </>
          )}

          {!isLoading && totalResults === 0 && query.length >= 3 && (
            <li className="px-4 py-3 text-sm text-muted-foreground" role="option" aria-selected={false}>No results found</li>
          )}
        </ul>
      )}
    </div>
  );
}
