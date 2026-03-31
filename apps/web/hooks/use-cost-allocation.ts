import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type AllocationRule = {
  id: string;
  name: string;
  tagKey: string;
  tagValue: string;
  team: string;
  percentage: number;
};

type UseCostAllocationOptions = {
  enabled?: boolean;
};

export function useCostAllocationRules(options?: UseCostAllocationOptions): UseQueryResult<{ rules: AllocationRule[] }> {
  return useQuery<{ rules: AllocationRule[] }>({
    queryKey: ['cost', 'allocation', 'rules'],
    queryFn: () => apiClient.get<{ rules: AllocationRule[] }>('/v1/cost/allocation/rules'),
    enabled: options?.enabled !== false,
  });
}

export function useCreateAllocationRule(): UseMutationResult<AllocationRule, Error, Partial<AllocationRule>> {
  const queryClient = useQueryClient();
  return useMutation<AllocationRule, Error, Partial<AllocationRule>>({
    mutationFn: (data) =>
      apiClient.post<AllocationRule>('/v1/cost/allocation/rules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost', 'allocation', 'rules'] });
    },
  });
}
