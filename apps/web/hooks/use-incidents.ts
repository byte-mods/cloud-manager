import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type Incident = {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  assignedTo: string | null;
  startedAt: string;
  resolvedAt: string | null;
};

type UseIncidentsOptions = {
  enabled?: boolean;
};

export function useIncidents(options?: UseIncidentsOptions): UseQueryResult<{ incidents: Incident[] }> {
  return useQuery<{ incidents: Incident[] }>({
    queryKey: ['incidents'],
    queryFn: () => apiClient.get<{ incidents: Incident[] }>('/v1/monitoring/incidents'),
    enabled: options?.enabled !== false,
  });
}

export function useIncident(id: string, options?: UseIncidentsOptions): UseQueryResult<Incident> {
  return useQuery<Incident>({
    queryKey: ['incidents', id],
    queryFn: () => apiClient.get<Incident>(`/v1/monitoring/incidents/${id}`),
    enabled: options?.enabled !== false && !!id,
  });
}

export function useUpdateIncident(): UseMutationResult<Incident, Error, { id: string; data: Partial<Incident> }> {
  const queryClient = useQueryClient();
  return useMutation<Incident, Error, { id: string; data: Partial<Incident> }>({
    mutationFn: ({ id, data }) =>
      apiClient.put<Incident>(`/v1/monitoring/incidents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}
