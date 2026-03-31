import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Period = 'this_month' | 'last_month' | 'quarter' | 'year'

export type TeamAllocation = {
  id: string
  team: string
  cloudSpend: number
  percentOfTotal: number
  budget: number
  utilization: number
  trend: number // positive = up, negative = down
}

export type MonthlyUnitEconomics = {
  month: string
  costPerCustomer: number
  costPerRequest: number
}

export type RIRecommendation = {
  id: string
  instanceType: string
  region: string
  provider: 'aws' | 'gcp' | 'azure'
  onDemandCost: number
  riCost: number
  savings: number
  term: '1yr' | '3yr'
  termLabel: string
}

export type WasteCategory = {
  name: string
  value: number
  color: string
}

type FinOpsKpis = {
  totalCloudSpend: number
  spendTrend: number
  costPerCustomer: number
  totalCustomers: number
  costPerRequest: number
  totalRequests: string
  infrastructureEfficiency: number
  riCoverage: number
  riTarget: number
  potentialMonthlySavings: number
  expiringRIsIn90Days: number
  totalMonthlyWaste: number
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type FinOpsState = {
  period: Period
  setPeriod: (period: Period) => void
  loading: boolean
  error: string | null
  initialized: boolean

  // KPIs
  totalCloudSpend: number
  spendTrend: number
  costPerCustomer: number
  totalCustomers: number
  costPerRequest: number
  totalRequests: string
  infrastructureEfficiency: number

  // Showback
  teamAllocations: TeamAllocation[]

  // Unit economics
  monthlyUnitEconomics: MonthlyUnitEconomics[]

  // RI
  riCoverage: number
  riTarget: number
  potentialMonthlySavings: number
  expiringRIsIn90Days: number
  riRecommendations: RIRecommendation[]

  // Waste
  wasteCategories: WasteCategory[]
  totalMonthlyWaste: number

  // Actions
  fetchAll: () => Promise<void>
  exportShowbackCSV: () => string
}

export const useFinOpsStore = create<FinOpsState>((set, get) => ({
  period: 'this_month',
  setPeriod: (period) => set({ period }),
  loading: false,
  error: null,
  initialized: false,

  totalCloudSpend: 0,
  spendTrend: 0,
  costPerCustomer: 0,
  totalCustomers: 0,
  costPerRequest: 0,
  totalRequests: '0',
  infrastructureEfficiency: 0,

  teamAllocations: [],
  monthlyUnitEconomics: [],

  riCoverage: 0,
  riTarget: 0,
  potentialMonthlySavings: 0,
  expiringRIsIn90Days: 0,
  riRecommendations: [],

  wasteCategories: [],
  totalMonthlyWaste: 0,

  fetchAll: async () => {
    if (get().initialized) return
    set({ loading: true, error: null })
    try {
      const [teamAllocations, monthlyUnitEconomics, riRecommendations, wasteCategories, kpis] =
        await Promise.all([
          apiClient.get<TeamAllocation[]>('/v1/cost/finops/team-allocations'),
          apiClient.get<MonthlyUnitEconomics[]>('/v1/cost/finops/unit-economics'),
          apiClient.get<RIRecommendation[]>('/v1/cost/finops/ri-recommendations'),
          apiClient.get<WasteCategory[]>('/v1/cost/finops/waste-categories'),
          apiClient.get<FinOpsKpis>('/v1/cost/finops/kpis'),
        ])
      set({
        teamAllocations,
        monthlyUnitEconomics,
        riRecommendations,
        wasteCategories,
        totalCloudSpend: kpis.totalCloudSpend,
        spendTrend: kpis.spendTrend,
        costPerCustomer: kpis.costPerCustomer,
        totalCustomers: kpis.totalCustomers,
        costPerRequest: kpis.costPerRequest,
        totalRequests: kpis.totalRequests,
        infrastructureEfficiency: kpis.infrastructureEfficiency,
        riCoverage: kpis.riCoverage,
        riTarget: kpis.riTarget,
        potentialMonthlySavings: kpis.potentialMonthlySavings,
        expiringRIsIn90Days: kpis.expiringRIsIn90Days,
        totalMonthlyWaste: kpis.totalMonthlyWaste,
        initialized: true,
        loading: false,
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch FinOps data', loading: false })
    }
  },

  exportShowbackCSV: () => {
    const headers = ['Team', 'Cloud Spend', '% of Total', 'Budget', 'Utilization', 'Trend']
    const rows = get().teamAllocations.map((t) =>
      [t.team, `$${t.cloudSpend}`, `${t.percentOfTotal}%`, `$${t.budget}`, `${t.utilization}%`, `${t.trend > 0 ? '+' : ''}${t.trend}%`].join(','),
    )
    return [headers.join(','), ...rows].join('\n')
  },
}))
