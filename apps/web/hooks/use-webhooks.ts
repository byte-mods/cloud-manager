import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type Webhook = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
};

type UseWebhooksOptions = {
  enabled?: boolean;
};

export function useWebhooks(options?: UseWebhooksOptions): UseQueryResult<{ webhooks: Webhook[] }> {
  return useQuery<{ webhooks: Webhook[] }>({
    queryKey: ['webhooks'],
    queryFn: () => apiClient.get<{ webhooks: Webhook[] }>('/v1/auth/webhooks'),
    enabled: options?.enabled !== false,
  });
}

export function useCreateWebhook(): UseMutationResult<Webhook, Error, Partial<Webhook>> {
  const queryClient = useQueryClient();
  return useMutation<Webhook, Error, Partial<Webhook>>({
    mutationFn: (data) =>
      apiClient.post<Webhook>('/v1/auth/webhooks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useDeleteWebhook(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiClient.delete<void>(`/v1/auth/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}
