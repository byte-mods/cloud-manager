import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type QueryResult = {
  columns: string[];
  rows: string[][];
  executionTime?: number;
  rowCount?: number;
};

export type Visualization = {
  id: string;
  name: string;
  type: 'line' | 'bar' | 'pie' | 'table' | 'scatter';
  dataSource: string;
  lastModified: string;
};

export type Report = {
  id: string;
  name: string;
  type: string;
  schedule: string;
  lastRun: string;
  status: 'success' | 'failed' | 'pending';
};

type UseAnalyticsOptions = {
  enabled?: boolean;
};

export function useAnalyticsQuery(
  query: string,
  options?: UseAnalyticsOptions
): UseQueryResult<QueryResult> {
  return useQuery<QueryResult>({
    queryKey: ['analytics', 'query', query],
    queryFn: () =>
      apiClient.post<QueryResult>('/v1/analytics/query', { query }),
    enabled: options?.enabled !== false && query.length > 0,
  });
}

export function useVisualizations(options?: UseAnalyticsOptions): UseQueryResult<{ visualizations: Visualization[] }> {
  return useQuery<{ visualizations: Visualization[] }>({
    queryKey: ['analytics', 'visualizations'],
    queryFn: () => apiClient.get<{ visualizations: Visualization[] }>('/v1/analytics/visualizations'),
    enabled: options?.enabled !== false,
  });
}

export function useReports(options?: UseAnalyticsOptions): UseQueryResult<{ reports: Report[] }> {
  return useQuery<{ reports: Report[] }>({
    queryKey: ['analytics', 'reports'],
    queryFn: () => apiClient.get<{ reports: Report[] }>('/v1/analytics/reports'),
    enabled: options?.enabled !== false,
  });
}

export type SearchIndex = {
  id: string;
  name: string;
  documentCount: number;
  sizeBytes: number;
  status: 'active' | 'building' | 'error';
  lastUpdated: string;
};

export type SearchResult = {
  id: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
  url: string;
};

export function useSearchIndexes(options?: UseAnalyticsOptions): UseQueryResult<{ indexes: SearchIndex[] }> {
  return useQuery<{ indexes: SearchIndex[] }>({
    queryKey: ['analytics', 'search-indexes'],
    queryFn: () => apiClient.get<{ indexes: SearchIndex[] }>('/v1/analytics/search/indexes'),
    enabled: options?.enabled !== false,
  });
}

export function useSearchResults(query: string, options?: UseAnalyticsOptions): UseQueryResult<{ results: SearchResult[] }> {
  return useQuery<{ results: SearchResult[] }>({
    queryKey: ['analytics', 'search', query],
    queryFn: () => apiClient.get<{ results: SearchResult[] }>(`/v1/analytics/search?q=${query}`),
    enabled: options?.enabled !== false && !!query,
  });
}