import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type Runbook = {
  id: string;
  title: string;
  triggerType: 'manual' | 'alert' | 'schedule';
  steps: string[];
  lastExecutedAt: string | null;
  executionCount: number;
};

type UseRunbooksOptions = {
  enabled?: boolean;
};

export function useRunbooks(options?: UseRunbooksOptions): UseQueryResult<{ runbooks: Runbook[] }> {
  return useQuery<{ runbooks: Runbook[] }>({
    queryKey: ['devops', 'runbooks'],
    queryFn: () => apiClient.get<{ runbooks: Runbook[] }>('/v1/cloud/devops/runbooks'),
    enabled: options?.enabled !== false,
  });
}

export function useExecuteRunbook(): UseMutationResult<void, Error, { id: string; params?: Record<string, string> }> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; params?: Record<string, string> }>({
    mutationFn: ({ id, params }) =>
      apiClient.post<void>(`/v1/cloud/devops/runbooks/${id}/execute`, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devops', 'runbooks'] });
    },
  });
}
