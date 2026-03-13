import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { SearchResponse, SearchResult } from '@/lib/types';

export function useSearch(query: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => apiFetch<SearchResponse>(`/api/v1/search/address?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 3,
    staleTime: 30 * 1000,
  });

  return {
    results: data?.results ?? [] as SearchResult[],
    isLoading,
  };
}
