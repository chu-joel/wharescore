import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { SearchResponse, SearchResult } from '@/lib/types';

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query, 200);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => apiFetch<SearchResponse>(`/api/v1/search/address?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 3,
    staleTime: 30 * 1000,
  });

  return {
    results: data?.results ?? [] as SearchResult[],
    isLoading: query.length >= 3 && (query !== debouncedQuery || isLoading),
  };
}

export { useDebouncedValue };
