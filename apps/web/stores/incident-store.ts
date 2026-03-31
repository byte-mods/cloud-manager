import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IncidentStatus = 'ACTIVE' | 'RESOLVED'
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low'

export type TimelineEventType = 'alert' | 'warning' | 'action' | 'resolution'

export type TimelineEvent = {
  id: string
  timestamp: Date
  type: TimelineEventType
  description: string
  relatedMetric?: string
}

export type AffectedService = {
  name: string
  status: 'degraded' | 'down' | 'recovering' | 'healthy'
}

export type MetricPoint = {
  time: string
  value: number
}

export type IncidentMetrics = {
  cpu: MetricPoint[]
  errorRate: MetricPoint[]
  latency: MetricPoint[]
  connections: MetricPoint[]
}

export type Incident = {
  id: string
  title: string
  status: IncidentStatus
  severity: IncidentSeverity
  startedAt: Date
  resolvedAt?: Date
  duration?: string
  acknowledged: boolean
  assignee?: string
  affectedServices: AffectedService[]
  impact?: string
  rootCauseAnalysis?: string
  timeline: TimelineEvent[]
  metrics: IncidentMetrics
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type IncidentStore = {
  incidents: Incident[]
  loading: boolean
  error: string | null
  initialized: boolean

  fetchIncidents: () => Promise<void>
  getActiveIncidents: () => Incident[]
  getIncidentById: (id: string) => Incident | undefined
  resolveIncident: (id: string) => Promise<void>
  acknowledgeIncident: (id: string) => Promise<void>
  addUpdate: (id: string, description: string, type: TimelineEventType) => void
}

export const useIncidentStore = create<IncidentStore>((set, get) => ({
  incidents: [],
  loading: false,
  error: null,
  initialized: false,

  fetchIncidents: async () => {
    if (get().initialized) return
    set({ loading: true, error: null })
    try {
      const data = await apiClient.get<Incident[]>('/v1/monitoring/incidents')
      set({ incidents: data, initialized: true, loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch incidents', loading: false })
    }
  },

  getActiveIncidents: () => get().incidents.filter((i) => i.status === 'ACTIVE'),

  getIncidentById: (id: string) => get().incidents.find((i) => i.id === id),

  resolveIncident: async (id: string) => {
    try {
      await apiClient.put(`/v1/monitoring/incidents/${id}/resolve`)
      set((state) => ({
        incidents: state.incidents.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'RESOLVED' as const,
                resolvedAt: new Date(),
                timeline: [
                  ...i.timeline,
                  {
                    id: `e${i.timeline.length + 1}`,
                    timestamp: new Date(),
                    type: 'resolution' as const,
                    description: 'Incident marked as resolved',
                  },
                ],
              }
            : i,
        ),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to resolve incident' })
    }
  },

  acknowledgeIncident: async (id: string) => {
    try {
      await apiClient.put(`/v1/monitoring/incidents/${id}/acknowledge`)
      set((state) => ({
        incidents: state.incidents.map((i) =>
          i.id === id
            ? {
                ...i,
                acknowledged: true,
                timeline: [
                  ...i.timeline,
                  {
                    id: `e${i.timeline.length + 1}`,
                    timestamp: new Date(),
                    type: 'action' as const,
                    description: 'Incident acknowledged',
                  },
                ],
              }
            : i,
        ),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to acknowledge incident' })
    }
  },

  addUpdate: (id: string, description: string, type: TimelineEventType = 'action') =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === id
          ? {
              ...i,
              timeline: [
                ...i.timeline,
                {
                  id: `e${i.timeline.length + 1}`,
                  timestamp: new Date(),
                  type,
                  description,
                },
              ],
            }
          : i,
      ),
    })),
}))
