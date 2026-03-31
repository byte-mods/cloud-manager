import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type MaintenanceWindow = {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  affectedServices: string[];
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  createdBy: string;
};

export function useMaintenanceWindows(): UseQueryResult<{ windows: MaintenanceWindow[] }> {
  return useQuery({ queryKey: ['maintenance-windows'], queryFn: () => apiClient.get('/v1/cloud/devops/maintenance-windows') });
}

export function useCreateMaintenanceWindow() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: Partial<MaintenanceWindow>) => apiClient.post('/v1/cloud/devops/maintenance-windows', data), onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance-windows'] }) });
}
