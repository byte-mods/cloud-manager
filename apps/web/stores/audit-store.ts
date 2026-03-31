import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditEventStatus = 'success' | 'failed' | 'warning'

export type AuditEvent = {
  id: string
  userId: string
  userName: string
  userEmail: string
  action: string
  resourceType: string
  resourceId: string
  details: Record<string, unknown>
  ipAddress: string
  userAgent: string
  status: AuditEventStatus
  createdAt: Date
}

export type AuditFilters = {
  user?: string
  action?: string
  resourceType?: string
  status?: AuditEventStatus
  startDate?: Date
  endDate?: Date
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type AuditStore = {
  events: AuditEvent[]
  loading: boolean
  error: string | null
  initialized: boolean

  fetchEvents: () => Promise<void>
  getEvents: (filters?: AuditFilters) => AuditEvent[]
  getEventById: (id: string) => AuditEvent | undefined
  getEventsByUser: (userId: string) => AuditEvent[]
  getEventsByResource: (resourceId: string) => AuditEvent[]
  exportEvents: (format: 'json' | 'csv') => string
}

export const useAuditStore = create<AuditStore>((set, get) => ({
  events: [],
  loading: false,
  error: null,
  initialized: false,

  fetchEvents: async () => {
    if (get().initialized) return
    set({ loading: true, error: null })
    try {
      const data = await apiClient.get<AuditEvent[]>('/v1/auth/audit-log')
      set({ events: data, initialized: true, loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch audit events', loading: false })
    }
  },

  getEvents: (filters) => {
    let events = get().events
    if (!filters) return events
    if (filters.user) {
      events = events.filter((e) => e.userName === filters.user || e.userEmail === filters.user)
    }
    if (filters.action) {
      events = events.filter((e) => e.action === filters.action)
    }
    if (filters.resourceType) {
      events = events.filter((e) => e.resourceType === filters.resourceType)
    }
    if (filters.status) {
      events = events.filter((e) => e.status === filters.status)
    }
    if (filters.startDate) {
      events = events.filter((e) => e.createdAt >= filters.startDate!)
    }
    if (filters.endDate) {
      events = events.filter((e) => e.createdAt <= filters.endDate!)
    }
    return events
  },

  getEventById: (id) => get().events.find((e) => e.id === id),

  getEventsByUser: (userId) => get().events.filter((e) => e.userId === userId),

  getEventsByResource: (resourceId) => get().events.filter((e) => e.resourceId === resourceId),

  exportEvents: (format) => {
    const events = get().events
    if (format === 'json') {
      return JSON.stringify(events, null, 2)
    }
    const headers = 'id,userName,userEmail,action,resourceType,resourceId,status,ipAddress,createdAt'
    const rows = events.map((e) =>
      `${e.id},${e.userName},${e.userEmail},${e.action},${e.resourceType},${e.resourceId},${e.status},${e.ipAddress},${e.createdAt}`
    )
    return [headers, ...rows].join('\n')
  },
}))
