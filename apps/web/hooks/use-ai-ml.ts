import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type AIModel = {
  id: string;
  name: string;
  provider: string;
  type: string;
  status: 'available' | 'training' | 'unavailable';
  version: string;
};

export type TrainingJob = {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'queued' | 'failed';
  progress: number;
  startedAt: string | null;
  estimatedCompletion: string | null;
  completedAt?: string;
};

export type MLOpsPipeline = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  lastRun: string;
  trigger: 'schedule' | 'webhook' | 'manual';
};

export type Experiment = {
  id: string;
  name: string;
  accuracy: number;
  loss: number;
  createdAt: string;
};

export type AIProductService = {
  id: string;
  name: string;
  type: string;
  status: 'healthy' | 'degraded' | 'down';
  callsToday: number;
  avgLatency: number;
};

export type GenAIAgent = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  createdAt: string;
};

export type RAGPipeline = {
  id: string;
  name: string;
  vectorStore: string;
  documents: number;
  status: 'active' | 'inactive';
};

type UseAIOptions = {
  enabled?: boolean;
};

export function useAIModels(options?: UseAIOptions): UseQueryResult<{ models: AIModel[] }> {
  return useQuery<{ models: AIModel[] }>({
    queryKey: ['ai-ml', 'models'],
    queryFn: () => apiClient.get<{ models: AIModel[] }>('/v1/ai-ml/models'),
    enabled: options?.enabled !== false,
  });
}

export function useTrainingJobs(options?: UseAIOptions): UseQueryResult<{ jobs: TrainingJob[] }> {
  return useQuery<{ jobs: TrainingJob[] }>({
    queryKey: ['ai-ml', 'training'],
    queryFn: () => apiClient.get<{ jobs: TrainingJob[] }>('/v1/ai-ml/training'),
    enabled: options?.enabled !== false,
  });
}

export function useMLOps(options?: UseAIOptions): UseQueryResult<{ pipelines: MLOpsPipeline[]; experiments: Experiment[] }> {
  return useQuery<{ pipelines: MLOpsPipeline[]; experiments: Experiment[] }>({
    queryKey: ['ai-ml', 'mlops'],
    queryFn: () => apiClient.get<{ pipelines: MLOpsPipeline[]; experiments: Experiment[] }>('/v1/ai-ml/mlops'),
    enabled: options?.enabled !== false,
  });
}

export function useAIProductServices(options?: UseAIOptions): UseQueryResult<{ services: AIProductService[] }> {
  return useQuery<{ services: AIProductService[] }>({
    queryKey: ['ai-ml', 'services'],
    queryFn: () => apiClient.get<{ services: AIProductService[] }>('/v1/ai-ml/services'),
    enabled: options?.enabled !== false,
  });
}

export function useGenAI(options?: UseAIOptions): UseQueryResult<{ agents: GenAIAgent[]; ragPipelines: RAGPipeline[] }> {
  return useQuery<{ agents: GenAIAgent[]; ragPipelines: RAGPipeline[] }>({
    queryKey: ['ai-ml', 'genai'],
    queryFn: () => apiClient.get<{ agents: GenAIAgent[]; ragPipelines: RAGPipeline[] }>('/v1/ai-ml/genai'),
    enabled: options?.enabled !== false,
  });
}
