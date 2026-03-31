import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnomalyStatus = 'ACTIVE' | 'INVESTIGATING' | 'RESOLVED' | 'AUTO_RESOLVED' | 'DISMISSED'
export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low'
export type CloudProvider = 'aws' | 'gcp' | 'azure'

export type CostAnomaly = {
  id: string
  service: string
  provider: CloudProvider
  amountAboveBaseline: number
  percentageIncrease: number
  detectedAt: Date
  status: AnomalyStatus
  severity: AnomalySeverity
  rootCauseAnalysis: string
  recommendedActions: string[]
  dailySpend: { date: string; actual: number; expected: number; upper: number; lower: number }[]
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type CostAnomalyState = {
  anomalies: CostAnomaly[]
  loading: boolean
  error: string | null
  initialized: boolean

  fetchAnomalies: () => Promise<void>
  getActiveAnomalies: () => CostAnomaly[]
  resolveAnomaly: (id: string) => void
  dismissAnomaly: (id: string) => Promise<void>
  investigateAnomaly: (id: string) => Promise<void>
  getAnomalyById: (id: string) => CostAnomaly | undefined
}

export const useCostAnomalyStore = create<CostAnomalyState>((set, get) => ({
  anomalies: [],
  loading: false,
  error: null,
  initialized: false,

  fetchAnomalies: async () => {
    if (get().initialized) return
    set({ loading: true, error: null })
    try {
      const data = await apiClient.get<CostAnomaly[]>('/v1/cost/anomalies')
      set({ anomalies: data, initialized: true, loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch anomalies', loading: false })
    }
  },

  getActiveAnomalies: () =>
    get().anomalies.filter((a) => a.status === 'ACTIVE' || a.status === 'INVESTIGATING'),

  resolveAnomaly: (id) =>
    set((state) => ({
      anomalies: state.anomalies.map((a) =>
        a.id === id ? { ...a, status: 'RESOLVED' as AnomalyStatus } : a,
      ),
    })),

  dismissAnomaly: async (id) => {
    try {
      await apiClient.put(`/v1/cost/anomalies/${id}/dismiss`)
      set((state) => ({
        anomalies: state.anomalies.map((a) =>
          a.id === id ? { ...a, status: 'DISMISSED' as AnomalyStatus } : a,
        ),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to dismiss anomaly' })
    }
  },

  investigateAnomaly: async (id) => {
    try {
      await apiClient.put(`/v1/cost/anomalies/${id}/investigate`)
      set((state) => ({
        anomalies: state.anomalies.map((a) =>
          a.id === id ? { ...a, status: 'INVESTIGATING' as AnomalyStatus } : a,
        ),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to investigate anomaly' })
    }
  },

  getAnomalyById: (id) => get().anomalies.find((a) => a.id === id),
}))
