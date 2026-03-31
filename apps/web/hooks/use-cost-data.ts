import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type TimeRange = '7d' | '30d' | '90d' | '1y';

type CostByProvider = {
  provider: string;
  amount: number;
  currency: string;
  percentageOfTotal: number;
};

type CostByService = {
  service: string;
  provider: string;
  amount: number;
  currency: string;
  percentageOfTotal: number;
};

type CostTrendPoint = {
  date: string;
  amount: number;
  currency: string;
};

type CostOverviewResponse = {
  totalCost: number;
  currency: string;
  costByProvider: CostByProvider[];
  costByService: CostByService[];
  costTrend: CostTrendPoint[];
  previousPeriodCost: number;
  changePercentage: number;
};

type UseCostDataReturn = {
  totalCost: number;
  currency: string;
  costByProvider: CostByProvider[];
  costByService: CostByService[];
  costTrend: CostTrendPoint[];
  previousPeriodCost: number;
  changePercentage: number;
  isLoading: boolean;
  error: Error | null;
  refetch: UseQueryResult<CostOverviewResponse>['refetch'];
};

export function useCostData(timeRange: TimeRange): UseCostDataReturn {
  const query = useQuery<CostOverviewResponse>({
    queryKey: ['cost', 'overview', timeRange],
    queryFn: () =>
      apiClient.get<CostOverviewResponse>(
        `/v1/cost/overview?timeRange=${timeRange}`
      ),
  });

  return {
    totalCost: query.data?.totalCost ?? 0,
    currency: query.data?.currency ?? 'USD',
    costByProvider: query.data?.costByProvider ?? [],
    costByService: query.data?.costByService ?? [],
    costTrend: query.data?.costTrend ?? [],
    previousPeriodCost: query.data?.previousPeriodCost ?? 0,
    changePercentage: query.data?.changePercentage ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export type Budget = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  spent: number;
  remaining: number;
  percentUsed: number;
  alerts: { threshold: number; notified: boolean }[];
  provider: string | null;
  service: string | null;
};

export type CostRecommendation = {
  id: string;
  type: 'rightsizing' | 'reserved-instance' | 'spot-instance' | 'unused-resource' | 'savings-plan';
  title: string;
  description: string;
  estimatedSavings: number;
  currency: string;
  provider: string;
  resource: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'applied' | 'dismissed';
};

export type CostForecast = {
  month: string;
  projected: number;
  lower: number;
  upper: number;
  currency: string;
};

export type Reservation = {
  id: string;
  provider: string;
  type: string;
  instanceType: string;
  region: string;
  status: 'active' | 'expired' | 'pending';
  startDate: string;
  endDate: string;
  monthlyCost: number;
  currency: string;
  utilization: number;
};

type UseCostOptions = {
  enabled?: boolean;
};

export function useBudgets(options?: UseCostOptions): UseQueryResult<{ budgets: Budget[] }> {
  return useQuery<{ budgets: Budget[] }>({
    queryKey: ['cost', 'budgets'],
    queryFn: () => apiClient.get<{ budgets: Budget[] }>('/v1/cost/budgets'),
    enabled: options?.enabled !== false,
  });
}

export function useCostRecommendations(options?: UseCostOptions): UseQueryResult<{ recommendations: CostRecommendation[] }> {
  return useQuery<{ recommendations: CostRecommendation[] }>({
    queryKey: ['cost', 'recommendations'],
    queryFn: () => apiClient.get<{ recommendations: CostRecommendation[] }>('/v1/cost/recommendations'),
    enabled: options?.enabled !== false,
  });
}

export function useCostForecast(months?: number, options?: UseCostOptions): UseQueryResult<{ forecasts: CostForecast[] }> {
  return useQuery<{ forecasts: CostForecast[] }>({
    queryKey: ['cost', 'forecast', months],
    queryFn: () => apiClient.get<{ forecasts: CostForecast[] }>(`/v1/cost/forecast?months=${months ?? 6}`),
    enabled: options?.enabled !== false,
  });
}

export function useReservations(options?: UseCostOptions): UseQueryResult<{ reservations: Reservation[] }> {
  return useQuery<{ reservations: Reservation[] }>({
    queryKey: ['cost', 'reservations'],
    queryFn: () => apiClient.get<{ reservations: Reservation[] }>('/v1/cost/reservations'),
    enabled: options?.enabled !== false,
  });
}

export type {
  TimeRange,
  CostByProvider,
  CostByService,
  CostTrendPoint,
  CostOverviewResponse,
  UseCostDataReturn,
};
