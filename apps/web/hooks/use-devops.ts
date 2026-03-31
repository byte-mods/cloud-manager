import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type Pipeline = {
  id: string;
  name: string;
  repository: string;
  branch: string;
  status: 'running' | 'succeeded' | 'failed' | 'pending' | 'cancelled';
  trigger: 'push' | 'manual' | 'schedule' | 'pr';
  lastRun: string | null;
  duration: number | null;
  stages: string[];
};

export type PipelineRun = {
  id: string;
  pipelineId: string;
  status: 'running' | 'succeeded' | 'failed' | 'pending' | 'cancelled';
  trigger: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  duration: number | null;
  commitSha: string;
  branch: string;
};

export type Deployment = {
  id: string;
  name: string;
  environment: 'production' | 'staging' | 'development';
  status: 'active' | 'rolling' | 'failed' | 'pending';
  version: string;
  deployedAt: string;
  deployedBy: string;
  provider: string;
  region: string;
};

export type GitOpsApp = {
  id: string;
  name: string;
  repository: string;
  path: string;
  syncStatus: 'synced' | 'out-of-sync' | 'unknown';
  healthStatus: 'healthy' | 'degraded' | 'missing' | 'unknown';
  lastSyncedAt: string | null;
  targetRevision: string;
  namespace: string;
};

export type IaCWorkspace = {
  id: string;
  name: string;
  provider: string;
  backend: string;
  status: 'applied' | 'planning' | 'drifted' | 'error';
  resourceCount: number;
  lastAppliedAt: string | null;
  lastPlanAt: string | null;
  version: string;
};

export type ConfigEntry = {
  id: string;
  key: string;
  value: string;
  environment: string;
  service: string;
  lastModified: string;
  modifiedBy: string;
};

type UseDevOpsOptions = {
  enabled?: boolean;
};

export function useDevOpsOverview(options?: UseDevOpsOptions): UseQueryResult<{
  totalPipelines: number;
  activeDeployments: number;
  failedPipelines: number;
  successRate: number;
}> {
  return useQuery({
    queryKey: ['devops', 'overview'],
    queryFn: () => apiClient.get('/v1/cloud/devops/overview'),
    enabled: options?.enabled !== false,
  });
}

export function usePipelines(options?: UseDevOpsOptions): UseQueryResult<{ pipelines: Pipeline[] }> {
  return useQuery<{ pipelines: Pipeline[] }>({
    queryKey: ['devops', 'pipelines'],
    queryFn: () => apiClient.get<{ pipelines: Pipeline[] }>('/v1/cloud/devops/pipelines'),
    enabled: options?.enabled !== false,
  });
}

export function usePipeline(id: string, options?: UseDevOpsOptions): UseQueryResult<Pipeline> {
  return useQuery<Pipeline>({
    queryKey: ['devops', 'pipeline', id],
    queryFn: () => apiClient.get<Pipeline>(`/v1/cloud/devops/pipelines/${id}`),
    enabled: options?.enabled !== false && !!id,
  });
}

export function useDeployments(options?: UseDevOpsOptions): UseQueryResult<{ deployments: Deployment[] }> {
  return useQuery<{ deployments: Deployment[] }>({
    queryKey: ['devops', 'deployments'],
    queryFn: () => apiClient.get<{ deployments: Deployment[] }>('/v1/cloud/devops/deployments'),
    enabled: options?.enabled !== false,
  });
}

export function useGitOps(options?: UseDevOpsOptions): UseQueryResult<{ apps: GitOpsApp[] }> {
  return useQuery<{ apps: GitOpsApp[] }>({
    queryKey: ['devops', 'gitops'],
    queryFn: () => apiClient.get<{ apps: GitOpsApp[] }>('/v1/cloud/devops/gitops'),
    enabled: options?.enabled !== false,
  });
}

export function useIaCWorkspaces(options?: UseDevOpsOptions): UseQueryResult<{ workspaces: IaCWorkspace[] }> {
  return useQuery<{ workspaces: IaCWorkspace[] }>({
    queryKey: ['devops', 'iac'],
    queryFn: () => apiClient.get<{ workspaces: IaCWorkspace[] }>('/v1/cloud/devops/iac'),
    enabled: options?.enabled !== false,
  });
}

export function useIaCWorkspace(id: string, options?: UseDevOpsOptions): UseQueryResult<IaCWorkspace> {
  return useQuery<IaCWorkspace>({
    queryKey: ['devops', 'iac', id],
    queryFn: () => apiClient.get<IaCWorkspace>(`/v1/cloud/devops/iac/${id}`),
    enabled: options?.enabled !== false && !!id,
  });
}

export function useDevOpsConfig(options?: UseDevOpsOptions): UseQueryResult<{ entries: ConfigEntry[] }> {
  return useQuery<{ entries: ConfigEntry[] }>({
    queryKey: ['devops', 'config'],
    queryFn: () => apiClient.get<{ entries: ConfigEntry[] }>('/v1/cloud/devops/config'),
    enabled: options?.enabled !== false,
  });
}

export function useTriggerPipeline(): UseMutationResult<PipelineRun, Error, { id: string; params?: Record<string, string> }> {
  const queryClient = useQueryClient();
  return useMutation<PipelineRun, Error, { id: string; params?: Record<string, string> }>({
    mutationFn: ({ id, params }) =>
      apiClient.post<PipelineRun>(`/v1/cloud/devops/pipelines/${id}/run`, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devops', 'pipelines'] });
    },
  });
}

export function useCreateDeployment(): UseMutationResult<Deployment, Error, Partial<Deployment>> {
  const queryClient = useQueryClient();
  return useMutation<Deployment, Error, Partial<Deployment>>({
    mutationFn: (data) =>
      apiClient.post<Deployment>('/v1/cloud/devops/deployments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devops', 'deployments'] });
    },
  });
}
