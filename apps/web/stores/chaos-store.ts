import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExperimentType =
  | 'instance_termination'
  | 'latency_injection'
  | 'network_partition'
  | 'cpu_stress'
  | 'disk_fill'
  | 'dns_failure'
  | 'dependency_failure'
  | 'zone_outage'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type ExperimentStatus = 'pending' | 'running' | 'completed' | 'aborted'
export type ExperimentResult = 'success' | 'failed' | 'aborted' | null

export type ExperimentCatalogItem = {
  type: ExperimentType
  name: string
  description: string
  risk: RiskLevel
  icon: string // lucide icon name
  parameters: ParameterDefinition[]
}

export type ParameterDefinition = {
  key: string
  label: string
  type: 'number' | 'select' | 'text'
  min?: number
  max?: number
  default?: number | string
  options?: { label: string; value: string }[]
}

export type ExperimentHistory = {
  id: string
  name: string
  type: ExperimentType
  target: string
  status: ExperimentStatus
  result: ExperimentResult
  recoveryTimeSeconds: number | null
  startedAt: Date
  completedAt: Date | null
  durationSeconds: number
  rollbackPlan: 'auto' | 'manual'
  parameters: Record<string, string | number>
  report: ExperimentReport | null
}

export type ExperimentReport = {
  timeline: { time: string; event: string }[]
  metricsBefore: { metric: string; value: string }[]
  metricsDuring: { metric: string; value: string }[]
  metricsAfter: { metric: string; value: string }[]
  affectedServices: string[]
  recoverySequence: string[]
  lessonsLearned: string[]
}

export type SafetySettings = {
  globalKillSwitch: boolean
  maxConcurrentExperiments: number
  requiredAuthorization: boolean
  autoRollbackTimeoutSeconds: number
  excludedResources: string[]
}

// ---------------------------------------------------------------------------
// Client-side reference data: experiment catalog
// ---------------------------------------------------------------------------

const catalog: ExperimentCatalogItem[] = [
  {
    type: 'instance_termination',
    name: 'Instance Termination',
    description: 'Kill a random instance in a group to test resilience',
    risk: 'medium',
    icon: 'ServerCrash',
    parameters: [
      { key: 'count', label: 'Instance Count', type: 'number', min: 1, max: 3, default: 1 },
      {
        key: 'recovery_action',
        label: 'Recovery Action',
        type: 'select',
        default: 'auto_restart',
        options: [
          { label: 'Auto Restart', value: 'auto_restart' },
          { label: 'Manual', value: 'manual' },
        ],
      },
    ],
  },
  {
    type: 'latency_injection',
    name: 'Latency Injection',
    description: 'Add 200-500ms latency to a service',
    risk: 'low',
    icon: 'Timer',
    parameters: [
      { key: 'delay_ms', label: 'Delay (ms)', type: 'number', min: 200, max: 2000, default: 300 },
      { key: 'jitter_ms', label: 'Jitter (ms)', type: 'number', min: 0, max: 500, default: 50 },
    ],
  },
  {
    type: 'network_partition',
    name: 'Network Partition',
    description: 'Isolate a service from its dependencies',
    risk: 'high',
    icon: 'Unplug',
    parameters: [
      { key: 'target_service', label: 'Target Service', type: 'text', default: '' },
      { key: 'duration_seconds', label: 'Duration (s)', type: 'number', min: 10, max: 600, default: 60 },
    ],
  },
  {
    type: 'cpu_stress',
    name: 'CPU Stress',
    description: 'Spike CPU to 90%+ on target instance',
    risk: 'medium',
    icon: 'Cpu',
    parameters: [
      { key: 'target_percent', label: 'Target CPU %', type: 'number', min: 70, max: 100, default: 90 },
      { key: 'duration_seconds', label: 'Duration (s)', type: 'number', min: 30, max: 300, default: 60 },
    ],
  },
  {
    type: 'disk_fill',
    name: 'Disk Fill',
    description: 'Fill disk to 90% capacity',
    risk: 'medium',
    icon: 'HardDrive',
    parameters: [
      { key: 'fill_percent', label: 'Fill %', type: 'number', min: 70, max: 95, default: 90 },
      { key: 'duration_seconds', label: 'Duration (s)', type: 'number', min: 30, max: 300, default: 120 },
    ],
  },
  {
    type: 'dns_failure',
    name: 'DNS Failure',
    description: 'Simulate DNS resolution failures',
    risk: 'high',
    icon: 'Globe',
    parameters: [
      { key: 'target_domain', label: 'Target Domain', type: 'text', default: '' },
      { key: 'duration_seconds', label: 'Duration (s)', type: 'number', min: 10, max: 300, default: 60 },
    ],
  },
  {
    type: 'dependency_failure',
    name: 'Dependency Failure',
    description: 'Make an external dependency return errors',
    risk: 'medium',
    icon: 'Link2Off',
    parameters: [
      { key: 'error_rate', label: 'Error Rate %', type: 'number', min: 50, max: 100, default: 100 },
      { key: 'error_code', label: 'HTTP Error Code', type: 'select', default: '500', options: [
        { label: '500 Internal Server Error', value: '500' },
        { label: '503 Service Unavailable', value: '503' },
        { label: '504 Gateway Timeout', value: '504' },
      ]},
    ],
  },
  {
    type: 'zone_outage',
    name: 'Zone Outage',
    description: 'Simulate availability zone failure',
    risk: 'critical',
    icon: 'CloudOff',
    parameters: [
      { key: 'zone', label: 'Availability Zone', type: 'text', default: '' },
      { key: 'duration_seconds', label: 'Duration (s)', type: 'number', min: 30, max: 600, default: 120 },
    ],
  },
]

const defaultSafetySettings: SafetySettings = {
  globalKillSwitch: false,
  maxConcurrentExperiments: 1,
  requiredAuthorization: true,
  autoRollbackTimeoutSeconds: 300,
  excludedResources: ['production-db-primary', 'production-db-replica', 'payment-gateway-prod'],
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type ChaosState = {
  catalog: ExperimentCatalogItem[]
  history: ExperimentHistory[]
  safetySettings: SafetySettings
  loading: boolean
  error: string | null
  initialized: boolean

  // Computed
  totalExperiments: number
  runningNow: number
  successRate: number
  avgRecoveryTime: number

  // Actions
  fetchExperiments: () => Promise<void>
  createExperiment: (experiment: Omit<ExperimentHistory, 'id' | 'startedAt' | 'completedAt' | 'status' | 'result' | 'report'>) => ExperimentHistory
  startExperiment: (id: string) => void
  abortExperiment: (id: string) => void
  getExperimentById: (id: string) => ExperimentHistory | undefined
  getHistory: () => ExperimentHistory[]
  updateSafetySettings: (settings: Partial<SafetySettings>) => void
}

export const useChaosStore = create<ChaosState>((set, get) => ({
  catalog,
  history: [],
  safetySettings: defaultSafetySettings,
  loading: false,
  error: null,
  initialized: false,

  get totalExperiments() {
    return get().history.length
  },
  get runningNow() {
    return get().history.filter((e) => e.status === 'running').length
  },
  get successRate() {
    const completed = get().history.filter((e) => e.status === 'completed')
    if (completed.length === 0) return 0
    const successes = completed.filter((e) => e.result === 'success').length
    return Math.round((successes / completed.length) * 100)
  },
  get avgRecoveryTime() {
    const withRecovery = get().history.filter((e) => e.recoveryTimeSeconds !== null)
    if (withRecovery.length === 0) return 0
    const total = withRecovery.reduce((s, e) => s + (e.recoveryTimeSeconds ?? 0), 0)
    return Math.round(total / withRecovery.length)
  },

  fetchExperiments: async () => {
    if (get().initialized) return
    set({ loading: true, error: null })
    try {
      const experiments = await apiClient.get<ExperimentHistory[]>('/cloud/aws/chaos/experiments')
      set({ history: experiments, loading: false, initialized: true })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to fetch experiments', loading: false })
    }
  },

  createExperiment: (experiment) => {
    const newExp: ExperimentHistory = {
      ...experiment,
      id: `exp-${Date.now()}`,
      startedAt: new Date(),
      completedAt: null,
      status: 'pending',
      result: null,
      report: null,
    }
    set((state) => ({ history: [newExp, ...state.history] }))
    return newExp
  },

  startExperiment: async (id) => {
    set((state) => ({
      history: state.history.map((e) =>
        e.id === id ? { ...e, status: 'running' as ExperimentStatus, startedAt: new Date() } : e,
      ),
    }))
    try {
      await apiClient.post(`/cloud/aws/chaos/experiments/${id}/run`)
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to start experiment' })
    }
  },

  abortExperiment: (id) =>
    set((state) => ({
      history: state.history.map((e) =>
        e.id === id
          ? { ...e, status: 'aborted' as ExperimentStatus, result: 'aborted' as ExperimentResult, completedAt: new Date() }
          : e,
      ),
    })),

  getExperimentById: (id) => get().history.find((e) => e.id === id),

  getHistory: () => get().history,

  updateSafetySettings: (settings) =>
    set((state) => ({
      safetySettings: { ...state.safetySettings, ...settings },
    })),
}))
