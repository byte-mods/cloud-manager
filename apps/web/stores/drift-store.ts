import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DriftStatus = 'IN_SYNC' | 'DRIFTED' | 'ADDED' | 'REMOVED'
export type CloudProvider = 'aws' | 'gcp' | 'azure'

export type DriftDiff = {
  field: string
  designed: string
  actual: string
}

export type DriftResource = {
  id: string
  name: string
  resourceType: string
  provider: CloudProvider
  status: DriftStatus
  description: string
  detectedAt: Date
  diffs: DriftDiff[]
  designedConfig: Record<string, string>
  actualConfig: Record<string, string>
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type DriftState = {
  resources: DriftResource[]
  lastScanTime: Date
  isScanning: boolean
  loading: boolean
  error: string | null
  initialized: boolean
  fetchResources: () => Promise<void>
  runDetection: () => Promise<void>
  acceptDrift: (id: string) => void
  remediateDrift: (id: string) => void
  ignoreDrift: (id: string) => void
  getDriftSummary: () => {
    total: number
    inSync: number
    drifted: number
    added: number
    removed: number
  }
}

export const useDriftStore = create<DriftState>((set, get) => ({
  resources: [],
  lastScanTime: new Date(),
  isScanning: false,
  loading: false,
  error: null,
  initialized: false,

  fetchResources: async () => {
    if (get().initialized) return
    set({ loading: true, error: null })
    try {
      const resources = await apiClient.get<DriftResource[]>('/cloud/drift/resources')
      set({ resources, loading: false, initialized: true })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to fetch drift resources', loading: false })
    }
  },

  runDetection: async () => {
    set({ isScanning: true, error: null })
    try {
      await apiClient.post('/cloud/drift/scan')
      // Re-fetch resources after scan completes
      const resources = await apiClient.get<DriftResource[]>('/cloud/drift/resources')
      set({
        resources,
        isScanning: false,
        lastScanTime: new Date(),
      })
    } catch (e) {
      set({ isScanning: false, error: e instanceof Error ? e.message : 'Failed to run drift detection' })
    }
  },

  acceptDrift: async (id) => {
    try {
      await apiClient.post(`/cloud/drift/resources/${id}/accept`)
      set((state) => ({
        resources: state.resources.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'IN_SYNC' as DriftStatus,
                description: 'Drift accepted - design updated to match actual state',
                diffs: [],
                designedConfig: { ...r.actualConfig },
              }
            : r,
        ),
      }))
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to accept drift' })
    }
  },

  remediateDrift: async (id) => {
    try {
      await apiClient.post(`/cloud/drift/resources/${id}/remediate`)
      set((state) => ({
        resources: state.resources.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'IN_SYNC' as DriftStatus,
                description: 'Remediated - actual state reverted to design',
                diffs: [],
                actualConfig: { ...r.designedConfig },
              }
            : r,
        ),
      }))
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to remediate drift' })
    }
  },

  ignoreDrift: (id) =>
    set((state) => ({
      resources: state.resources.map((r) =>
        r.id === id
          ? { ...r, status: 'IN_SYNC' as DriftStatus, description: 'Drift ignored', diffs: [] }
          : r,
      ),
    })),

  getDriftSummary: () => {
    const resources = get().resources
    return {
      total: resources.length,
      inSync: resources.filter((r) => r.status === 'IN_SYNC').length,
      drifted: resources.filter((r) => r.status === 'DRIFTED').length,
      added: resources.filter((r) => r.status === 'ADDED').length,
      removed: resources.filter((r) => r.status === 'REMOVED').length,
    }
  },
}))
