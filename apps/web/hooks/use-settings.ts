import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  timezone: string;
  language: string;
  createdAt: string;
  lastLogin: string;
};

export type NotificationPreferences = {
  email: boolean;
  push: boolean;
  slack: boolean;
  alerts: {
    costThreshold: boolean;
    securityIncidents: boolean;
    deploymentStatus: boolean;
    resourceUsage: boolean;
  };
  digest: 'daily' | 'weekly' | 'none';
};

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string | null;
  scopes: string[];
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  memberCount: number;
  teamCount: number;
  createdAt: string;
};

export type OrgMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
  lastActive: string;
};

export type Team = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  createdAt: string;
};

export type CloudAccount = {
  id: string;
  provider: 'aws' | 'azure' | 'gcp';
  name: string;
  accountId: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSynced: string | null;
  regions: string[];
};

type UseSettingsOptions = {
  enabled?: boolean;
};

export function useProfile(options?: UseSettingsOptions): UseQueryResult<UserProfile> {
  return useQuery<UserProfile>({
    queryKey: ['settings', 'profile'],
    queryFn: () => apiClient.get<UserProfile>('/v1/auth/profile'),
    enabled: options?.enabled !== false,
  });
}

export function useUpdateProfile(): UseMutationResult<UserProfile, Error, Partial<UserProfile>> {
  const queryClient = useQueryClient();
  return useMutation<UserProfile, Error, Partial<UserProfile>>({
    mutationFn: (data) => apiClient.put<UserProfile>('/v1/auth/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
    },
  });
}

export function useChangePassword(): UseMutationResult<void, Error, { currentPassword: string; newPassword: string }> {
  return useMutation<void, Error, { currentPassword: string; newPassword: string }>({
    mutationFn: (data) => apiClient.put<void>('/v1/auth/profile/password', data),
  });
}

export function useNotificationPreferences(options?: UseSettingsOptions): UseQueryResult<NotificationPreferences> {
  return useQuery<NotificationPreferences>({
    queryKey: ['settings', 'notifications'],
    queryFn: () => apiClient.get<NotificationPreferences>('/v1/auth/notifications/preferences'),
    enabled: options?.enabled !== false,
  });
}

export function useUpdateNotificationPreferences(): UseMutationResult<NotificationPreferences, Error, Partial<NotificationPreferences>> {
  const queryClient = useQueryClient();
  return useMutation<NotificationPreferences, Error, Partial<NotificationPreferences>>({
    mutationFn: (data) => apiClient.put<NotificationPreferences>('/v1/auth/notifications/preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'notifications'] });
    },
  });
}

export function useApiKeys(options?: UseSettingsOptions): UseQueryResult<{ keys: ApiKey[] }> {
  return useQuery<{ keys: ApiKey[] }>({
    queryKey: ['settings', 'api-keys'],
    queryFn: () => apiClient.get<{ keys: ApiKey[] }>('/v1/auth/api-keys'),
    enabled: options?.enabled !== false,
  });
}

export function useCreateApiKey(): UseMutationResult<ApiKey & { secret: string }, Error, { name: string; scopes: string[]; expiresAt?: string }> {
  const queryClient = useQueryClient();
  return useMutation<ApiKey & { secret: string }, Error, { name: string; scopes: string[]; expiresAt?: string }>({
    mutationFn: (data) => apiClient.post<ApiKey & { secret: string }>('/v1/auth/api-keys', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] });
    },
  });
}

export function useRevokeApiKey(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete<void>(`/v1/auth/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] });
    },
  });
}

export function useOrganization(options?: UseSettingsOptions): UseQueryResult<Organization> {
  return useQuery<Organization>({
    queryKey: ['settings', 'organization'],
    queryFn: () => apiClient.get<Organization>('/v1/auth/organization'),
    enabled: options?.enabled !== false,
  });
}

export function useOrgMembers(options?: UseSettingsOptions): UseQueryResult<{ members: OrgMember[] }> {
  return useQuery<{ members: OrgMember[] }>({
    queryKey: ['settings', 'org-members'],
    queryFn: () => apiClient.get<{ members: OrgMember[] }>('/v1/auth/organization/members'),
    enabled: options?.enabled !== false,
  });
}

export function useOrgTeams(options?: UseSettingsOptions): UseQueryResult<{ teams: Team[] }> {
  return useQuery<{ teams: Team[] }>({
    queryKey: ['settings', 'org-teams'],
    queryFn: () => apiClient.get<{ teams: Team[] }>('/v1/auth/organization/teams'),
    enabled: options?.enabled !== false,
  });
}

export function useCloudAccounts(options?: UseSettingsOptions): UseQueryResult<{ accounts: CloudAccount[] }> {
  return useQuery<{ accounts: CloudAccount[] }>({
    queryKey: ['settings', 'cloud-accounts'],
    queryFn: () => apiClient.get<{ accounts: CloudAccount[] }>('/v1/auth/cloud-accounts'),
    enabled: options?.enabled !== false,
  });
}
