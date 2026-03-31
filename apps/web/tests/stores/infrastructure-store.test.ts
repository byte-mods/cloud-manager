import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useInfrastructureStore,
  getTemplates,
  SERVICE_CATALOG,
  analyzeSecurityIssues,
  type ServiceNode,
} from '@/stores/infrastructure-store'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('infrastructure-store', () => {
  beforeEach(() => {
    localStorageMock.clear()
    useInfrastructureStore.setState({
      projects: [],
      currentProject: null,
      selectedNodeId: null,
    })
  })

  // ---- createProject ----
  it('createProject creates with correct fields', () => {
    const id = useInfrastructureStore.getState().createProject('Test Project', 'A description', 'aws')
    expect(id).toBeDefined()
    expect(typeof id).toBe('string')

    const state = useInfrastructureStore.getState()
    expect(state.currentProject).not.toBeNull()
    expect(state.currentProject!.name).toBe('Test Project')
    expect(state.currentProject!.description).toBe('A description')
    expect(state.currentProject!.provider).toBe('aws')
    expect(state.currentProject!.nodes).toEqual([])
    expect(state.currentProject!.edges).toEqual([])
    expect(state.currentProject!.totalEstimatedCost).toBe(0)
    expect(state.currentProject!.createdAt).toBeDefined()
    expect(state.currentProject!.updatedAt).toBeDefined()
  })

  // ---- saveProject and loadProject roundtrip ----
  it('saveProject and loadProject roundtrip via localStorage', () => {
    const id = useInfrastructureStore.getState().createProject('Roundtrip', 'Desc', 'gcp')
    useInfrastructureStore.getState().saveProject()

    // Clear current project
    useInfrastructureStore.setState({ currentProject: null })
    expect(useInfrastructureStore.getState().currentProject).toBeNull()

    // Reload
    useInfrastructureStore.getState().loadProject(id)
    const loaded = useInfrastructureStore.getState().currentProject
    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe(id)
    expect(loaded!.name).toBe('Roundtrip')
    expect(loaded!.provider).toBe('gcp')
  })

  // ---- deleteProject ----
  it('deleteProject removes project', () => {
    const id = useInfrastructureStore.getState().createProject('To Delete', 'Desc', 'aws')
    useInfrastructureStore.getState().saveProject()
    useInfrastructureStore.getState().deleteProject(id)

    const state = useInfrastructureStore.getState()
    expect(state.currentProject).toBeNull()
    expect(state.projects.find((p) => p.id === id)).toBeUndefined()
  })

  // ---- addNode ----
  it('addNode adds to current project', () => {
    useInfrastructureStore.getState().createProject('Node Test', 'Desc', 'aws')

    const serviceNode: ServiceNode = {
      id: 'node-1',
      type: 'compute',
      provider: 'aws',
      serviceName: 'EC2',
      label: 'Web Server',
      config: { instanceType: 't3.medium' },
      estimatedMonthlyCost: 30,
      securityIssues: [],
      trafficIn: 1000,
      trafficOut: 1000,
    }

    useInfrastructureStore.getState().addNode(serviceNode, { x: 100, y: 200 })
    const project = useInfrastructureStore.getState().currentProject!
    expect(project.nodes).toHaveLength(1)
    expect(project.nodes[0].id).toBe('node-1')
    expect(project.nodes[0].position).toEqual({ x: 100, y: 200 })
    expect((project.nodes[0].data.serviceNode as ServiceNode).serviceName).toBe('EC2')
  })

  // ---- removeNode ----
  it('removeNode removes from project', () => {
    useInfrastructureStore.getState().createProject('Remove Test', 'Desc', 'aws')

    const serviceNode: ServiceNode = {
      id: 'node-rm',
      type: 'compute',
      provider: 'aws',
      serviceName: 'EC2',
      label: 'Test',
      config: {},
      estimatedMonthlyCost: 30,
      securityIssues: [],
      trafficIn: 0,
      trafficOut: 0,
    }

    useInfrastructureStore.getState().addNode(serviceNode, { x: 0, y: 0 })
    expect(useInfrastructureStore.getState().currentProject!.nodes).toHaveLength(1)

    useInfrastructureStore.getState().removeNode('node-rm')
    expect(useInfrastructureStore.getState().currentProject!.nodes).toHaveLength(0)
  })

  // ---- removeNode also removes related edges ----
  it('removeNode also removes edges connected to the removed node', () => {
    useInfrastructureStore.getState().createProject('Edge Test', 'Desc', 'aws')

    const sn1: ServiceNode = {
      id: 'n1', type: 'compute', provider: 'aws', serviceName: 'EC2', label: 'A',
      config: {}, estimatedMonthlyCost: 0, securityIssues: [], trafficIn: 0, trafficOut: 0,
    }
    const sn2: ServiceNode = {
      id: 'n2', type: 'database', provider: 'aws', serviceName: 'RDS', label: 'B',
      config: {}, estimatedMonthlyCost: 0, securityIssues: [], trafficIn: 0, trafficOut: 0,
    }

    useInfrastructureStore.getState().addNode(sn1, { x: 0, y: 0 })
    useInfrastructureStore.getState().addNode(sn2, { x: 100, y: 100 })
    useInfrastructureStore.getState().addConnection({
      source: 'n1', target: 'n2', protocol: 'TCP', port: 5432, encrypted: true,
    })

    expect(useInfrastructureStore.getState().currentProject!.edges).toHaveLength(1)
    useInfrastructureStore.getState().removeNode('n1')
    expect(useInfrastructureStore.getState().currentProject!.edges).toHaveLength(0)
  })

  // ---- getTotalCost ----
  it('getTotalCost sums node costs', () => {
    useInfrastructureStore.getState().createProject('Cost Test', 'Desc', 'aws')

    const sn1: ServiceNode = {
      id: 'c1', type: 'compute', provider: 'aws', serviceName: 'EC2', label: 'A',
      config: {}, estimatedMonthlyCost: 30, securityIssues: [], trafficIn: 0, trafficOut: 0,
    }
    const sn2: ServiceNode = {
      id: 'c2', type: 'database', provider: 'aws', serviceName: 'RDS', label: 'B',
      config: {}, estimatedMonthlyCost: 200, securityIssues: [], trafficIn: 0, trafficOut: 0,
    }

    useInfrastructureStore.getState().addNode(sn1, { x: 0, y: 0 })
    useInfrastructureStore.getState().addNode(sn2, { x: 0, y: 100 })
    expect(useInfrastructureStore.getState().getTotalCost()).toBe(230)
  })

  it('getTotalCost returns 0 when no project', () => {
    useInfrastructureStore.setState({ currentProject: null })
    expect(useInfrastructureStore.getState().getTotalCost()).toBe(0)
  })

  // ---- getSecuritySummary ----
  it('getSecuritySummary counts issues', () => {
    useInfrastructureStore.getState().createProject('Security Test', 'Desc', 'aws')

    const sn: ServiceNode = {
      id: 's1', type: 'storage', provider: 'aws', serviceName: 'S3', label: 'Bucket',
      config: { publicAccess: true },
      estimatedMonthlyCost: 23,
      securityIssues: [],
      trafficIn: 0,
      trafficOut: 0,
    }

    useInfrastructureStore.getState().addNode(sn, { x: 0, y: 0 })
    const summary = useInfrastructureStore.getState().getSecuritySummary()
    // analyzeSecurityIssues produces issues for storage without encryption and with publicAccess
    expect(summary.total).toBeGreaterThan(0)
    expect(summary.critical).toBeGreaterThanOrEqual(1) // publicAccess -> critical
    expect(summary.high).toBeGreaterThanOrEqual(1)     // no encryption -> high
  })

  it('getSecuritySummary returns zeros when no project', () => {
    useInfrastructureStore.setState({ currentProject: null })
    const summary = useInfrastructureStore.getState().getSecuritySummary()
    expect(summary).toEqual({ critical: 0, high: 0, medium: 0, low: 0, total: 0 })
  })

  // ---- templates ----
  it('templates load correctly (3 templates exist)', () => {
    const templates = getTemplates()
    expect(templates).toHaveLength(3)
    expect(templates[0].name).toBe('3-Tier Web App')
    expect(templates[1].name).toBe('Microservices')
    expect(templates[2].name).toBe('Serverless API')
  })

  it('each template has nodes and edges', () => {
    const templates = getTemplates()
    for (const t of templates) {
      expect(t.nodes.length).toBeGreaterThan(0)
      expect(t.edges.length).toBeGreaterThan(0)
      expect(t.provider).toBeDefined()
      expect(t.totalEstimatedCost).toBeGreaterThan(0)
    }
  })

  // ---- duplicateProject ----
  it('duplicateProject creates copy with new id', () => {
    const id = useInfrastructureStore.getState().createProject('Original', 'Desc', 'aws')
    useInfrastructureStore.getState().saveProject()

    const dupId = useInfrastructureStore.getState().duplicateProject(id)
    expect(dupId).toBeDefined()
    expect(dupId).not.toBe(id)

    useInfrastructureStore.getState().loadProject(dupId)
    const dup = useInfrastructureStore.getState().currentProject!
    expect(dup.name).toBe('Original (Copy)')
    expect(dup.id).toBe(dupId)
    expect(dup.provider).toBe('aws')
  })

  it('duplicateProject returns empty string for nonexistent project', () => {
    const result = useInfrastructureStore.getState().duplicateProject('nonexistent')
    expect(result).toBe('')
  })

  // ---- SERVICE_CATALOG ----
  it('SERVICE_CATALOG contains entries for all three providers', () => {
    const providers = new Set(SERVICE_CATALOG.map((s) => s.provider))
    expect(providers.has('aws')).toBe(true)
    expect(providers.has('gcp')).toBe(true)
    expect(providers.has('azure')).toBe(true)
  })

  // ---- analyzeSecurityIssues ----
  it('analyzeSecurityIssues flags unencrypted storage', () => {
    const node: ServiceNode = {
      id: 'test', type: 'storage', provider: 'aws', serviceName: 'S3', label: 'Test',
      config: { encryption: false }, estimatedMonthlyCost: 0, securityIssues: [], trafficIn: 0, trafficOut: 0,
    }
    const issues = analyzeSecurityIssues(node)
    expect(issues.some((i) => i.message === 'Encryption not enabled')).toBe(true)
  })

  it('analyzeSecurityIssues flags public storage access', () => {
    const node: ServiceNode = {
      id: 'test', type: 'storage', provider: 'aws', serviceName: 'S3', label: 'Test',
      config: { publicAccess: true, encryption: true }, estimatedMonthlyCost: 0, securityIssues: [], trafficIn: 0, trafficOut: 0,
    }
    const issues = analyzeSecurityIssues(node)
    expect(issues.some((i) => i.severity === 'critical')).toBe(true)
  })

  it('analyzeSecurityIssues flags single AZ database', () => {
    const node: ServiceNode = {
      id: 'test', type: 'database', provider: 'aws', serviceName: 'RDS', label: 'Test',
      config: { multiAz: false, encryption: true }, estimatedMonthlyCost: 0, securityIssues: [], trafficIn: 0, trafficOut: 0,
    }
    const issues = analyzeSecurityIssues(node)
    expect(issues.some((i) => i.message === 'Single AZ deployment')).toBe(true)
  })

  it('analyzeSecurityIssues flags default security group', () => {
    const node: ServiceNode = {
      id: 'test', type: 'networking', provider: 'aws', serviceName: 'VPC', label: 'Test',
      config: { defaultSecurityGroup: true }, estimatedMonthlyCost: 0, securityIssues: [], trafficIn: 0, trafficOut: 0,
    }
    const issues = analyzeSecurityIssues(node)
    expect(issues.some((i) => i.message === 'Using default security group')).toBe(true)
  })

  it('analyzeSecurityIssues flags missing IMDSv2 for compute', () => {
    const node: ServiceNode = {
      id: 'test', type: 'compute', provider: 'aws', serviceName: 'EC2', label: 'Test',
      config: { imdsv2: false }, estimatedMonthlyCost: 0, securityIssues: [], trafficIn: 0, trafficOut: 0,
    }
    const issues = analyzeSecurityIssues(node)
    expect(issues.some((i) => i.message === 'IMDSv2 not enforced')).toBe(true)
  })
})
