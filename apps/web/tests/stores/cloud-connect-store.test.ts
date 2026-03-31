import { describe, it, expect, beforeEach } from 'vitest'
import { useCloudConnectStore, type CloudAccount } from '@/stores/cloud-connect-store'

// Capture the initial seed state so we can reset to it
const seedState = useCloudConnectStore.getState()

describe('cloud-connect-store', () => {
  beforeEach(() => {
    // Reset to seed state before each test
    useCloudConnectStore.setState({
      accounts: seedState.accounts,
      services: seedState.services,
      selectedServiceId: null,
      activities: seedState.activities,
    })
  })

  // ---- Initial state ----
  it('initial state has 3 accounts', () => {
    const state = useCloudConnectStore.getState()
    expect(state.accounts).toHaveLength(3)
  })

  it('initial state accounts cover all three providers', () => {
    const providers = useCloudConnectStore.getState().accounts.map((a) => a.provider)
    expect(providers).toContain('aws')
    expect(providers).toContain('gcp')
    expect(providers).toContain('azure')
  })

  it('initial state has correct AWS service count (28)', () => {
    const awsServices = useCloudConnectStore.getState().services.filter((s) => s.provider === 'aws')
    expect(awsServices).toHaveLength(28)
  })

  it('initial state has correct GCP service count (18)', () => {
    const gcpServices = useCloudConnectStore.getState().services.filter((s) => s.provider === 'gcp')
    expect(gcpServices).toHaveLength(18)
  })

  it('initial state has Azure services', () => {
    const azureServices = useCloudConnectStore.getState().services.filter((s) => s.provider === 'azure')
    expect(azureServices.length).toBeGreaterThanOrEqual(12)
  })

  // ---- getServicesByAccount ----
  it('getServicesByAccount filters correctly for AWS', () => {
    const services = useCloudConnectStore.getState().getServicesByAccount('acc-aws-prod')
    expect(services.length).toBe(28)
    expect(services.every((s) => s.accountId === 'acc-aws-prod')).toBe(true)
  })

  it('getServicesByAccount filters correctly for GCP', () => {
    const services = useCloudConnectStore.getState().getServicesByAccount('acc-gcp-prod')
    expect(services.length).toBe(18)
    expect(services.every((s) => s.accountId === 'acc-gcp-prod')).toBe(true)
  })

  it('getServicesByAccount returns empty for unknown account', () => {
    const services = useCloudConnectStore.getState().getServicesByAccount('unknown')
    expect(services).toHaveLength(0)
  })

  // ---- getServicesByType ----
  it('getServicesByType filters by compute type', () => {
    const computeServices = useCloudConnectStore.getState().getServicesByType('compute')
    expect(computeServices.length).toBeGreaterThan(0)
    expect(computeServices.every((s) => s.type === 'compute')).toBe(true)
  })

  it('getServicesByType filters by database type', () => {
    const dbServices = useCloudConnectStore.getState().getServicesByType('database')
    expect(dbServices.length).toBeGreaterThan(0)
    expect(dbServices.every((s) => s.type === 'database')).toBe(true)
  })

  // ---- getServiceById ----
  it('getServiceById returns correct service', () => {
    const svc = useCloudConnectStore.getState().getServiceById('aws-ec2-web1')
    expect(svc).toBeDefined()
    expect(svc!.resourceName).toBe('web-server-1')
    expect(svc!.provider).toBe('aws')
  })

  it('getServiceById returns undefined for unknown id', () => {
    const svc = useCloudConnectStore.getState().getServiceById('nonexistent')
    expect(svc).toBeUndefined()
  })

  // ---- getCrossCloudConnections ----
  it('getCrossCloudConnections returns cross-provider connections', () => {
    const connections = useCloudConnectStore.getState().getCrossCloudConnections()
    expect(connections.length).toBeGreaterThan(0)
    for (const conn of connections) {
      expect(conn.from.provider).not.toBe(conn.to.provider)
    }
  })

  // ---- getTotalCost ----
  it('getTotalCost returns sum greater than $15,000', () => {
    const totalCost = useCloudConnectStore.getState().getTotalCost()
    expect(totalCost).toBeGreaterThan(15000)
  })

  it('getTotalCost returns a number', () => {
    const totalCost = useCloudConnectStore.getState().getTotalCost()
    expect(typeof totalCost).toBe('number')
    expect(Number.isFinite(totalCost)).toBe(true)
  })

  // ---- getSecuritySummary ----
  it('getSecuritySummary counts all issues', () => {
    const summary = useCloudConnectStore.getState().getSecuritySummary()
    expect(summary.critical).toBeGreaterThanOrEqual(1)
    expect(summary.high).toBeGreaterThanOrEqual(1)
    expect(summary.medium).toBeGreaterThanOrEqual(1)
    expect(summary.low).toBeGreaterThanOrEqual(1)
    const total = summary.critical + summary.high + summary.medium + summary.low + summary.info
    expect(total).toBeGreaterThan(0)
  })

  // ---- addAccount ----
  it('addAccount adds new account', () => {
    const newAccount: CloudAccount = {
      id: 'acc-new',
      provider: 'aws',
      name: 'New Account',
      accountId: '999999999999',
      status: 'connected',
      lastSynced: null,
      resourceCount: 0,
      monthlyCost: 0,
      securityScore: 100,
      regions: ['us-east-1'],
    }

    useCloudConnectStore.getState().addAccount(newAccount)
    const accounts = useCloudConnectStore.getState().accounts
    expect(accounts).toHaveLength(4)
    expect(accounts.find((a) => a.id === 'acc-new')).toBeDefined()
  })

  // ---- removeAccount ----
  it('removeAccount removes account and its services', () => {
    useCloudConnectStore.getState().removeAccount('acc-azure-dev')
    const state = useCloudConnectStore.getState()
    expect(state.accounts.find((a) => a.id === 'acc-azure-dev')).toBeUndefined()
    expect(state.services.filter((s) => s.accountId === 'acc-azure-dev')).toHaveLength(0)
  })

  it('removeAccount does not affect other accounts', () => {
    const awsCountBefore = useCloudConnectStore.getState().services.filter((s) => s.provider === 'aws').length
    useCloudConnectStore.getState().removeAccount('acc-azure-dev')
    const awsCountAfter = useCloudConnectStore.getState().services.filter((s) => s.provider === 'aws').length
    expect(awsCountAfter).toBe(awsCountBefore)
  })

  // ---- syncAccount ----
  it('syncAccount updates lastSynced and sets status to syncing', () => {
    useCloudConnectStore.getState().syncAccount('acc-aws-prod')
    const account = useCloudConnectStore.getState().accounts.find((a) => a.id === 'acc-aws-prod')
    expect(account).toBeDefined()
    expect(account!.status).toBe('syncing')
    expect(account!.lastSynced).toBeDefined()
    expect(account!.lastSynced).not.toBeNull()
  })

  // ---- setSelectedService ----
  it('setSelectedService sets and clears selection', () => {
    useCloudConnectStore.getState().setSelectedService('aws-ec2-web1')
    expect(useCloudConnectStore.getState().selectedServiceId).toBe('aws-ec2-web1')
    useCloudConnectStore.getState().setSelectedService(null)
    expect(useCloudConnectStore.getState().selectedServiceId).toBeNull()
  })
})
