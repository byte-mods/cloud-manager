import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useCloudProvider } from './use-cloud-provider';

export type TopologyNode = { id: string; type: string; name: string; status: string; region: string; connections: string[] };
export type TrafficFlow = { source: string; destination: string; protocol: string; bytesIn: number; bytesOut: number; status: string };
export type CloudService = { id: string; name: string; type: string; status: string; provider: string; region: string; endpoint: string };

export function useCloudTopology(): UseQueryResult<{ nodes: TopologyNode[] }> {
  const { provider } = useCloudProvider();
  return useQuery({ queryKey: ['cloud-connect', 'topology', provider], queryFn: () => apiClient.get(`/v1/cloud/${provider}/topology`) });
}

export function useCloudTraffic(): UseQueryResult<{ flows: TrafficFlow[] }> {
  const { provider } = useCloudProvider();
  return useQuery({ queryKey: ['cloud-connect', 'traffic', provider], queryFn: () => apiClient.get(`/v1/cloud/${provider}/traffic/flows`) });
}

export function useCloudServices(): UseQueryResult<{ services: CloudService[] }> {
  const { provider } = useCloudProvider();
  return useQuery({ queryKey: ['cloud-connect', 'services', provider], queryFn: () => apiClient.get(`/v1/cloud/${provider}/services`) });
}
