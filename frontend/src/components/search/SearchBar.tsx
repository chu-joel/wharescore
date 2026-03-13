'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearchStore } from '@/stores/searchStore';
import { useMapStore } from '@/stores/mapStore';
import { useSearch } from '@/hooks/useSearch';

const MAX_QUERY_LENGTH = 200;

interface SearchBarProps {
  /** Compact mode for header — shorter height */
  compact?: boolean;
}

export function SearchBar({ compact = false }: SearchBarProps) {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const selectProperty = useMapStore((s) => s.selectProperty);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { results, isLoading } = useSearch(query);

  const handleSelect = useCallback(
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

  useEffect(() => {
    setIsOpen(query.length >= 3 && results.length > 0);
    setActiveIndex(-1);
  }, [query, results]);

  // Close dropdown on outside click
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
    if (!isOpen || results.length === 0) {
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
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
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
          placeholder="Search any NZ address..."
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 3 && results.length > 0 && setIsOpen(true)}
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
          {results.map((r, i) => (
            <li
              key={r.address_id}
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => handleSelect(r)}
              className={`w-full text-left px-4 py-2.5 cursor-pointer transition-colors text-sm border-b border-border last:border-0 flex items-center gap-3 ${
                i === activeIndex ? 'bg-muted' : 'hover:bg-muted'
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
          ))}
          {!isLoading && results.length === 0 && query.length >= 3 && (
            <li className="px-4 py-3 text-sm text-muted-foreground" role="option" aria-selected={false}>No addresses found</li>
          )}
        </ul>
      )}
    </div>
  );
}
