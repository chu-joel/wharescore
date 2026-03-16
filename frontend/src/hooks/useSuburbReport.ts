import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { SuburbSummary, SuburbSearchResult } from '@/lib/types';
import { useDebouncedValue } from './useSearch';

export function useSuburbReport(sa2Code: string | null) {
  return useQuery({
    queryKey: ['suburb-report', sa2Code],
    queryFn: () => apiFetch<SuburbSummary>(`/api/v1/suburb/${sa2Code}`),
    enabled: sa2Code !== null,
    staleTime: 60 * 60 * 1000,
  });
}

export function useSuburbSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query, 200);

  const { data, isLoading } = useQuery({
    queryKey: ['suburb-search', debouncedQuery],
    queryFn: () => apiFetch<{ results: SuburbSearchResult[] }>(`/api/v1/search/suburb?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30 * 1000,
  });

  return {
    results: data?.results ?? [],
    isLoading: query.length >= 2 && (query !== debouncedQuery || isLoading),
  };
}
