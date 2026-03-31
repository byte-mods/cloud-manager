import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type SearchHit = {
  id: string;
  name: string;
  resourceType: string;
  provider: string;
  region: string;
  status: string;
};

export function useGlobalSearch(query: string): UseQueryResult<{ results: SearchHit[] }> {
  return useQuery<{ results: SearchHit[] }>({
    queryKey: ['global-search', query],
    queryFn: () => apiClient.get<{ results: SearchHit[] }>(`/v1/analytics/search/global?q=${encodeURIComponent(query)}`),
    enabled: query.length > 2,
  });
}
