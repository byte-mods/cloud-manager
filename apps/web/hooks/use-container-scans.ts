import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type ContainerScan = {
  id: string;
  image: string;
  registry: string;
  tag: string;
  status: 'scanning' | 'completed' | 'failed';
  vulnerabilities: { critical: number; high: number; medium: number; low: number };
  scannedAt: string;
};

export function useContainerScans(): UseQueryResult<{ scans: ContainerScan[] }> {
  return useQuery({ queryKey: ['container-scans'], queryFn: () => apiClient.get('/v1/security/container-scans') });
}

export function useTriggerContainerScan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { image: string; tag: string }) => apiClient.post('/v1/security/container-scans', data), onSuccess: () => qc.invalidateQueries({ queryKey: ['container-scans'] }) });
}
