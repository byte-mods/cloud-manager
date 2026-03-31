import { describe, it, expect, beforeEach } from 'vitest'
import { useCloudContextStore } from '@/stores/cloud-context-store'

describe('cloud-context-store', () => {
  beforeEach(() => {
    useCloudContextStore.setState({
      provider: 'aws',
      region: 'us-east-1',
      accountId: '',
      accountName: '',
      availableAccounts: [],
    })
  })

  it('has correct initial state', () => {
    const state = useCloudContextStore.getState()
    expect(state.provider).toBe('aws')
    expect(state.region).toBe('us-east-1')
    expect(state.accountId).toBe('')
    expect(state.accountName).toBe('')
    expect(state.availableAccounts).toEqual([])
  })

  it('setProvider changes provider and resets region for gcp', () => {
    useCloudContextStore.getState().setProvider('gcp')
    const state = useCloudContextStore.getState()
    expect(state.provider).toBe('gcp')
    expect(state.region).toBe('us-central1')
  })

  it('setProvider changes provider and resets region for azure', () => {
    useCloudContextStore.getState().setProvider('azure')
    const state = useCloudContextStore.getState()
    expect(state.provider).toBe('azure')
    expect(state.region).toBe('eastus')
  })

  it('setProvider back to aws resets region to us-east-1', () => {
    useCloudContextStore.getState().setProvider('gcp')
    useCloudContextStore.getState().setProvider('aws')
    expect(useCloudContextStore.getState().region).toBe('us-east-1')
  })

  it('setRegion changes region', () => {
    useCloudContextStore.getState().setRegion('eu-west-1')
    expect(useCloudContextStore.getState().region).toBe('eu-west-1')
  })

  it('setRegion does not change provider', () => {
    useCloudContextStore.getState().setRegion('us-west-2')
    expect(useCloudContextStore.getState().provider).toBe('aws')
  })

  it('setAccount updates accountId and accountName', () => {
    useCloudContextStore.getState().setAccount('acc-123', 'My Account')
    const state = useCloudContextStore.getState()
    expect(state.accountId).toBe('acc-123')
    expect(state.accountName).toBe('My Account')
  })

  it('setAvailableAccounts updates the list', () => {
    const accounts = [
      { id: '1', name: 'AWS Prod', provider: 'aws' as const },
      { id: '2', name: 'GCP Dev', provider: 'gcp' as const },
    ]
    useCloudContextStore.getState().setAvailableAccounts(accounts)
    expect(useCloudContextStore.getState().availableAccounts).toEqual(accounts)
  })
})
