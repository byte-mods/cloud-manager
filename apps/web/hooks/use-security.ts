import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type IAMUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  provider: string;
  status: 'active' | 'inactive' | 'pending';
  lastLogin: string | null;
};

export type IAMPolicy = {
  id: string;
  name: string;
  description: string;
  attachedUsers: number;
  permissions: string[];
};

export type Secret = {
  id: string;
  name: string;
  type: string;
  provider: string;
  lastRotated: string;
  expiresAt: string | null;
};

export type Certificate = {
  id: string;
  domain: string;
  provider: string;
  issuer: string;
  validFrom: string;
  validUntil: string;
  status: 'valid' | 'expiring' | 'expired';
};

export type AuditLog = {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  resource: string;
  status: 'success' | 'failed';
};

export type Vulnerability = {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  affectedResource: string;
  status: 'open' | 'remediated' | 'accepted';
};

type UseSecurityOptions = {
  enabled?: boolean;
};

export function useIAMUsers(options?: UseSecurityOptions): UseQueryResult<{ users: IAMUser[] }> {
  return useQuery<{ users: IAMUser[] }>({
    queryKey: ['security', 'iam', 'users'],
    queryFn: () => apiClient.get<{ users: IAMUser[] }>('/v1/security/iam/users'),
    enabled: options?.enabled !== false,
  });
}

export function useIAMPolicies(options?: UseSecurityOptions): UseQueryResult<{ policies: IAMPolicy[] }> {
  return useQuery<{ policies: IAMPolicy[] }>({
    queryKey: ['security', 'iam', 'policies'],
    queryFn: () => apiClient.get<{ policies: IAMPolicy[] }>('/v1/security/iam/policies'),
    enabled: options?.enabled !== false,
  });
}

export function useSecrets(options?: UseSecurityOptions): UseQueryResult<{ secrets: Secret[] }> {
  return useQuery<{ secrets: Secret[] }>({
    queryKey: ['security', 'secrets'],
    queryFn: () => apiClient.get<{ secrets: Secret[] }>('/v1/security/secrets'),
    enabled: options?.enabled !== false,
  });
}

export function useCertificates(options?: UseSecurityOptions): UseQueryResult<{ certificates: Certificate[] }> {
  return useQuery<{ certificates: Certificate[] }>({
    queryKey: ['security', 'certificates'],
    queryFn: () => apiClient.get<{ certificates: Certificate[] }>('/v1/security/certificates'),
    enabled: options?.enabled !== false,
  });
}

export function useAuditLogs(options?: UseSecurityOptions): UseQueryResult<{ logs: AuditLog[] }> {
  return useQuery<{ logs: AuditLog[] }>({
    queryKey: ['security', 'audit'],
    queryFn: () => apiClient.get<{ logs: AuditLog[] }>('/v1/security/audit'),
    enabled: options?.enabled !== false,
  });
}

export function useVulnerabilities(options?: UseSecurityOptions): UseQueryResult<{ vulnerabilities: Vulnerability[] }> {
  return useQuery<{ vulnerabilities: Vulnerability[] }>({
    queryKey: ['security', 'vapt'],
    queryFn: () => apiClient.get<{ vulnerabilities: Vulnerability[] }>('/v1/security/vapt'),
    enabled: options?.enabled !== false,
  });
}