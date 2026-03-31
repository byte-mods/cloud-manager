import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type SLATarget = {
  serviceName: string;
  targetUptime: number;
  actualUptime: number;
  targetLatency: number;
  actualLatency: number;
};

type UseSLAOptions = {
  enabled?: boolean;
};

export function useSLATargets(options?: UseSLAOptions): UseQueryResult<{ targets: SLATarget[] }> {
  return useQuery<{ targets: SLATarget[] }>({
    queryKey: ['sla', 'targets'],
    queryFn: () => apiClient.get<{ targets: SLATarget[] }>('/v1/monitoring/sla'),
    enabled: options?.enabled !== false,
  });
}
