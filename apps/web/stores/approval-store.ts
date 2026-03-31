import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TriggerType = 'deploy' | 'infra_change' | 'security_change' | 'cost_threshold'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'
export type ApproverRole = 'cloud_architect' | 'devops_engineer' | 'system_admin' | 'security_engineer'

export type ApprovalWorkflow = {
  id: string
  name: string
  triggerType: TriggerType
  triggerDescription: string
  conditions: Record<string, unknown>
  requiredApprovers: number
  approverRoles: ApproverRole[]
  autoApproveConditions: string | null
  enabled: boolean
  createdAt: Date
}

export type ApprovalRequest = {
  id: string
  title: string
  workflowId: string
  workflowName: string
  requestedBy: {
    name: string
    email: string
    avatar: string
  }
  status: ApprovalStatus
  details: Record<string, unknown>
  submittedAt: Date
  resolvedAt?: Date
  resolvedBy?: string
  reason?: string
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type ApprovalStore = {
  workflows: ApprovalWorkflow[]
  requests: ApprovalRequest[]
  loading: boolean
  error: string | null
  initialized: boolean

  fetchWorkflows: () => Promise<void>
  fetchRequests: () => Promise<void>
  createWorkflow: (workflow: Omit<ApprovalWorkflow, 'id' | 'createdAt'>) => Promise<void>
  updateWorkflow: (id: string, updates: Partial<ApprovalWorkflow>) => Promise<void>
  submitRequest: (request: Omit<ApprovalRequest, 'id' | 'submittedAt' | 'status'>) => Promise<void>
  approveRequest: (id: string, reason: string) => Promise<void>
  rejectRequest: (id: string, reason: string) => Promise<void>
  getMyPendingApprovals: () => ApprovalRequest[]
  getAllRequests: () => ApprovalRequest[]
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  workflows: [],
  requests: [],
  loading: false,
  error: null,
  initialized: false,

  fetchWorkflows: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiClient.get<ApprovalWorkflow[]>('/v1/auth/approvals/workflows')
      set({ workflows: data, loading: false, initialized: true })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch workflows', loading: false })
    }
  },

  fetchRequests: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiClient.get<ApprovalRequest[]>('/v1/auth/approvals')
      set({ requests: data, loading: false, initialized: true })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch requests', loading: false })
    }
  },

  createWorkflow: async (workflow) => {
    try {
      const created = await apiClient.post<ApprovalWorkflow>('/v1/auth/approvals/workflows', workflow)
      set((state) => ({ workflows: [...state.workflows, created] }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create workflow' })
    }
  },

  updateWorkflow: async (id, updates) => {
    try {
      const updated = await apiClient.put<ApprovalWorkflow>(`/v1/auth/approvals/workflows/${id}`, updates)
      set((state) => ({
        workflows: state.workflows.map((w) =>
          w.id === id ? { ...w, ...updated } : w,
        ),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update workflow' })
    }
  },

  submitRequest: async (request) => {
    try {
      const created = await apiClient.post<ApprovalRequest>('/v1/auth/approvals', request)
      set((state) => ({ requests: [created, ...state.requests] }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to submit request' })
    }
  },

  approveRequest: async (id, reason) => {
    try {
      await apiClient.put(`/v1/auth/approvals/${id}/approve`, { reason })
      set((state) => ({
        requests: state.requests.map((r) =>
          r.id === id
            ? { ...r, status: 'approved' as const, resolvedAt: new Date(), resolvedBy: 'Admin', reason }
            : r,
        ),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to approve request' })
    }
  },

  rejectRequest: async (id, reason) => {
    try {
      await apiClient.put(`/v1/auth/approvals/${id}/reject`, { reason })
      set((state) => ({
        requests: state.requests.map((r) =>
          r.id === id
            ? { ...r, status: 'rejected' as const, resolvedAt: new Date(), resolvedBy: 'Admin', reason }
            : r,
        ),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to reject request' })
    }
  },

  getMyPendingApprovals: () => get().requests.filter((r) => r.status === 'pending'),

  getAllRequests: () => get().requests,
}))
