import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useCloudProvider } from './use-cloud-provider';

type Resource = {
  id: string;
  name: string;
  type: string;
  status: string;
  region: string;
  provider: string;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type ResourcesResponse = {
  resources: Resource[];
  total: number;
  nextToken?: string;
};

type UseResourcesOptions = {
  enabled?: boolean;
};

export function useResources(
  resourceType: string,
  options?: UseResourcesOptions
): UseQueryResult<ResourcesResponse> {
  const { provider, region } = useCloudProvider();

  return useQuery<ResourcesResponse>({
    queryKey: ['resources', provider, region, resourceType],
    queryFn: () =>
      apiClient.get<ResourcesResponse>(
        `/v1/cloud/${provider}/${resourceType}`,
        {
          headers: {
            'X-Cloud-Region': region,
          },
        }
      ),
    enabled: options?.enabled !== false && !!provider && !!resourceType,
  });
}

export type { Resource, ResourcesResponse, UseResourcesOptions };
