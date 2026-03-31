import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type EdgeDevice = {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  type: string;
  location: string;
  lastSeen: string;
  firmware: string;
  metrics: {
    cpu: number;
    memory: number;
    temperature: number;
  };
};

export type IoTRule = {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  enabled: boolean;
  lastTriggered: string | null;
  triggerCount: number;
};

export type DigitalTwin = {
  id: string;
  name: string;
  modelId: string;
  status: 'active' | 'inactive' | 'error';
  lastUpdated: string;
  properties: Record<string, unknown>;
  telemetry: Record<string, unknown>;
};

type UseIoTOptions = {
  enabled?: boolean;
};

export function useIoTEdgeDevices(provider: string, options?: UseIoTOptions): UseQueryResult<{ devices: EdgeDevice[] }> {
  return useQuery<{ devices: EdgeDevice[] }>({
    queryKey: ['iot', 'edge', provider],
    queryFn: () => apiClient.get<{ devices: EdgeDevice[] }>(`/v1/cloud/${provider}/iot/edge`),
    enabled: options?.enabled !== false && !!provider,
  });
}

export function useIoTRules(provider: string, options?: UseIoTOptions): UseQueryResult<{ rules: IoTRule[] }> {
  return useQuery<{ rules: IoTRule[] }>({
    queryKey: ['iot', 'rules', provider],
    queryFn: () => apiClient.get<{ rules: IoTRule[] }>(`/v1/cloud/${provider}/iot/rules`),
    enabled: options?.enabled !== false && !!provider,
  });
}

export function useDigitalTwins(provider: string, options?: UseIoTOptions): UseQueryResult<{ twins: DigitalTwin[] }> {
  return useQuery<{ twins: DigitalTwin[] }>({
    queryKey: ['iot', 'twins', provider],
    queryFn: () => apiClient.get<{ twins: DigitalTwin[] }>(`/v1/cloud/${provider}/iot/twins`),
    enabled: options?.enabled !== false && !!provider,
  });
}
