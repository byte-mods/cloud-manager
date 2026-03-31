import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type DependencyNode = {
  id: string;
  name: string;
  type: string;
  provider: string;
  region: string;
  status: string;
};

export type DependencyEdge = {
  id: string;
  source: string;
  target: string;
  relationship: string;
};

type UseDependenciesOptions = {
  enabled?: boolean;
};

export function useDependencyGraph(
  provider: string,
  options?: UseDependenciesOptions
): UseQueryResult<{ nodes: DependencyNode[]; edges: DependencyEdge[] }> {
  return useQuery<{ nodes: DependencyNode[]; edges: DependencyEdge[] }>({
    queryKey: ['dependencies', provider],
    queryFn: () =>
      apiClient.get<{ nodes: DependencyNode[]; edges: DependencyEdge[] }>(
        `/v1/cloud/${provider}/dependencies`
      ),
    enabled: options?.enabled !== false && !!provider,
  });
}
