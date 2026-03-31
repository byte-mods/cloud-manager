import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type SecurityCategory = {
  name: string;
  score: number;
  maxScore: number;
  findings: number;
  criticalFindings: number;
};

type SecurityTrendPoint = {
  date: string;
  score: number;
};

type SecurityScoreResponse = {
  score: number;
  maxScore: number;
  grade: string;
  categories: SecurityCategory[];
  trend: SecurityTrendPoint[];
  lastAssessedAt: string;
};

type UseSecurityScoreReturn = {
  score: number;
  maxScore: number;
  grade: string;
  categories: SecurityCategory[];
  trend: SecurityTrendPoint[];
  lastAssessedAt: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: UseQueryResult<SecurityScoreResponse>['refetch'];
};

export function useSecurityScore(): UseSecurityScoreReturn {
  const query = useQuery<SecurityScoreResponse>({
    queryKey: ['security', 'posture', 'score'],
    queryFn: () =>
      apiClient.get<SecurityScoreResponse>('/v1/security/posture/score'),
  });

  return {
    score: query.data?.score ?? 0,
    maxScore: query.data?.maxScore ?? 100,
    grade: query.data?.grade ?? '-',
    categories: query.data?.categories ?? [],
    trend: query.data?.trend ?? [],
    lastAssessedAt: query.data?.lastAssessedAt ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export type {
  SecurityCategory,
  SecurityTrendPoint,
  SecurityScoreResponse,
  UseSecurityScoreReturn,
};
