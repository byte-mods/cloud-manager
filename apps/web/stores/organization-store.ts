import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer'
export type MemberStatus = 'active' | 'invited'

export type Team = {
  id: string
  name: string
  description: string
  memberCount: number
  cloudAccountsCount: number
  monthlyCost: number
}

export type Project = {
  id: string
  name: string
  description: string
  teamId: string
  budgetLimit: number
  currentSpend: number
  status: 'on-track' | 'at-risk' | 'over-budget'
  tags: string[]
}

export type OrgMember = {
  id: string
  name: string
  email: string
  role: MemberRole
  teamId: string
  status: MemberStatus
  lastActive: string
  avatarUrl?: string
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type OrganizationStore = {
  teams: Team[]
  projects: Project[]
  members: OrgMember[]
  loading: boolean
  error: string | null
  initialized: boolean

  // Fetch
  fetchTeams: () => Promise<void>
  fetchProjects: () => Promise<void>
  fetchMembers: () => Promise<void>

  // Teams CRUD
  addTeam: (team: Omit<Team, 'id'>) => Promise<void>
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>
  deleteTeam: (id: string) => Promise<void>
  getTeamById: (id: string) => Team | undefined
  getTeamName: (teamId: string) => string

  // Projects CRUD
  addProject: (project: Omit<Project, 'id'>) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // Members CRUD
  addMember: (member: Omit<OrgMember, 'id'>) => Promise<void>
  updateMember: (id: string, updates: Partial<OrgMember>) => Promise<void>
  removeMember: (id: string) => Promise<void>
  getMembersByTeam: (teamId: string) => OrgMember[]
}

export const useOrganizationStore = create<OrganizationStore>((set, get) => ({
  teams: [],
  projects: [],
  members: [],
  loading: false,
  error: null,
  initialized: false,

  // Fetch
  fetchTeams: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiClient.get<Team[]>('/v1/auth/organizations/teams')
      set({ teams: data, loading: false, initialized: true })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch teams', loading: false })
    }
  },

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiClient.get<Project[]>('/v1/auth/organizations/projects')
      set({ projects: data, loading: false, initialized: true })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch projects', loading: false })
    }
  },

  fetchMembers: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiClient.get<OrgMember[]>('/v1/auth/organizations/members')
      set({ members: data, loading: false, initialized: true })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch members', loading: false })
    }
  },

  // Teams
  addTeam: async (team) => {
    try {
      const created = await apiClient.post<Team>('/v1/auth/organizations/teams', team)
      set((state) => ({ teams: [...state.teams, created] }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add team' })
    }
  },
  updateTeam: async (id, updates) => {
    try {
      const updated = await apiClient.put<Team>(`/v1/auth/organizations/teams/${id}`, updates)
      set((state) => ({ teams: state.teams.map((t) => (t.id === id ? { ...t, ...updated } : t)) }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update team' })
    }
  },
  deleteTeam: async (id) => {
    try {
      await apiClient.delete(`/v1/auth/organizations/teams/${id}`)
      set((state) => ({ teams: state.teams.filter((t) => t.id !== id) }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete team' })
    }
  },
  getTeamById: (id) => get().teams.find((t) => t.id === id),
  getTeamName: (teamId) => get().teams.find((t) => t.id === teamId)?.name ?? 'Unknown',

  // Projects
  addProject: async (project) => {
    try {
      const created = await apiClient.post<Project>('/v1/auth/organizations/projects', project)
      set((state) => ({ projects: [...state.projects, created] }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add project' })
    }
  },
  updateProject: async (id, updates) => {
    try {
      const updated = await apiClient.put<Project>(`/v1/auth/organizations/projects/${id}`, updates)
      set((state) => ({ projects: state.projects.map((p) => (p.id === id ? { ...p, ...updated } : p)) }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update project' })
    }
  },
  deleteProject: async (id) => {
    try {
      await apiClient.delete(`/v1/auth/organizations/projects/${id}`)
      set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete project' })
    }
  },

  // Members
  addMember: async (member) => {
    try {
      const created = await apiClient.post<OrgMember>('/v1/auth/organizations/members', member)
      set((state) => ({ members: [...state.members, created] }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add member' })
    }
  },
  updateMember: async (id, updates) => {
    try {
      const updated = await apiClient.put<OrgMember>(`/v1/auth/organizations/members/${id}`, updates)
      set((state) => ({ members: state.members.map((m) => (m.id === id ? { ...m, ...updated } : m)) }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update member' })
    }
  },
  removeMember: async (id) => {
    try {
      await apiClient.delete(`/v1/auth/organizations/members/${id}`)
      set((state) => ({ members: state.members.filter((m) => m.id !== id) }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to remove member' })
    }
  },
  getMembersByTeam: (teamId) => get().members.filter((m) => m.teamId === teamId),
}))
