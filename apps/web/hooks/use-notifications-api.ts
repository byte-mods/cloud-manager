import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type Notification = {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  resourceId?: string;
  module?: string;
  read: boolean;
  createdAt: string;
};

export function useNotificationsApi(): UseQueryResult<{ notifications: Notification[] }> {
  return useQuery({ queryKey: ['notifications'], queryFn: () => apiClient.get('/v1/auth/notifications'), refetchInterval: 30000 });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.put(`/v1/auth/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
}
