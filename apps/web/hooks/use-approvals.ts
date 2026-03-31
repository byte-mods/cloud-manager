import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type ApprovalRequest = {
  id: string;
  requester: string;
  title: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
};

type UseApprovalsOptions = {
  enabled?: boolean;
};

export function useApprovalRequests(options?: UseApprovalsOptions): UseQueryResult<{ requests: ApprovalRequest[] }> {
  return useQuery<{ requests: ApprovalRequest[] }>({
    queryKey: ['approvals'],
    queryFn: () => apiClient.get<{ requests: ApprovalRequest[] }>('/v1/auth/approvals'),
    enabled: options?.enabled !== false,
  });
}

export function useApproveRequest(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiClient.post<void>(`/v1/auth/approvals/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}

export function useRejectRequest(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiClient.post<void>(`/v1/auth/approvals/${id}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}
