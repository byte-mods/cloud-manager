import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type DriftItem = {
  resourceId: string;
  resourceType: string;
  expected: string;
  actual: string;
  field: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
};

type UseDriftOptions = {
  enabled?: boolean;
};

export function useDriftDetection(options?: UseDriftOptions): UseQueryResult<{ drifts: DriftItem[] }> {
  return useQuery<{ drifts: DriftItem[] }>({
    queryKey: ['drift'],
    queryFn: () => apiClient.get<{ drifts: DriftItem[] }>('/v1/cloud/drift'),
    enabled: options?.enabled !== false,
  });
}
