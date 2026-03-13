'use client';

import { useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearchStore } from '@/stores/searchStore';
import { useSearch } from '@/hooks/useSearch';
import type { SearchResult } from '@/lib/types';

interface SearchOverlayProps {
  onSelect: (result: SearchResult) => void;
}

export function SearchOverlay({ onSelect }: SearchOverlayProps) {
  const { query, setQuery, isOverlayOpen, closeOverlay } = useSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const { results } = useSearch(query);

  useEffect(() => {
    if (isOverlayOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOverlayOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeOverlay]);

  if (!isOverlayOpen) return null;

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    closeOverlay();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 h-14 px-3 border-b border-border">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any NZ address..."
          className="flex-1 border-0 shadow-none focus-visible:ring-0"
          maxLength={200}
        />
        <button
          onClick={closeOverlay}
          className="text-sm text-piq-primary font-medium shrink-0 px-2"
        >
          Cancel
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length > 0 ? (
          <ul>
            {results.slice(0, 6).map((result: SearchResult) => (
              <li key={result.address_id}>
                <button
                  onClick={() => handleSelect(result)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{result.full_address}</p>
                    <p className="text-xs text-muted-foreground">{result.suburb}, {result.city}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : query.length >= 3 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No addresses found
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Type at least 3 characters to search
          </div>
        )}
      </div>
    </div>
  );
}
