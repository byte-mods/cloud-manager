import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type ETLJob = {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'scheduled';
  schedule: string;
  lastRun: string | null;
  nextRun: string | null;
};

export type StreamingPipeline = {
  id: string;
  name: string;
  source: string;
  destination: string;
  status: 'running' | 'stopped' | 'error';
  throughput: number;
};

export type DataLakeDataset = {
  id: string;
  name: string;
  format: string;
  size: string;
  location: string;
  lastUpdated: string;
};

type UseDataEngineeringOptions = {
  enabled?: boolean;
};

export function useETLJobs(options?: UseDataEngineeringOptions): UseQueryResult<{ jobs: ETLJob[] }> {
  return useQuery<{ jobs: ETLJob[] }>({
    queryKey: ['data-engineering', 'etl'],
    queryFn: () => apiClient.get<{ jobs: ETLJob[] }>('/v1/data-engineering/etl'),
    enabled: options?.enabled !== false,
  });
}

export function useStreamingPipelines(options?: UseDataEngineeringOptions): UseQueryResult<{ pipelines: StreamingPipeline[] }> {
  return useQuery<{ pipelines: StreamingPipeline[] }>({
    queryKey: ['data-engineering', 'streaming'],
    queryFn: () => apiClient.get<{ pipelines: StreamingPipeline[] }>('/v1/data-engineering/streaming'),
    enabled: options?.enabled !== false,
  });
}

export function useDataLakeDatasets(options?: UseDataEngineeringOptions): UseQueryResult<{ datasets: DataLakeDataset[] }> {
  return useQuery<{ datasets: DataLakeDataset[] }>({
    queryKey: ['data-engineering', 'data-lake'],
    queryFn: () => apiClient.get<{ datasets: DataLakeDataset[] }>('/v1/data-engineering/data-lake'),
    enabled: options?.enabled !== false,
  });
}