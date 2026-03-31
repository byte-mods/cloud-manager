import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type AuditEntry = {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  statusCode: number;
  createdAt: string;
};

export function useAuditLog(limit?: number): UseQueryResult<{ logs: AuditEntry[] }> {
  return useQuery({ queryKey: ['audit-log', limit], queryFn: () => apiClient.get(`/v1/auth/audit-log?limit=${limit ?? 50}`) });
}
