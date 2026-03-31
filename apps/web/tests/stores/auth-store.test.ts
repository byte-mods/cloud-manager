import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

import { useAuthStore } from '@/stores/auth-store'
import type { User } from '@/stores/auth-store'

const testUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'cloud_architect',
  mfaEnabled: true,
  organization: 'TestOrg',
}

describe('auth-store', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true })
  })

  it('has correct initial state', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(true)
  })

  it('setUser sets user and isAuthenticated to true', () => {
    useAuthStore.getState().setUser(testUser)
    const state = useAuthStore.getState()
    expect(state.user).toEqual(testUser)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
  })

  it('setUser with null clears auth', () => {
    useAuthStore.getState().setUser(testUser)
    useAuthStore.getState().setUser(null)
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('setLoading updates loading state', () => {
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
    useAuthStore.getState().setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)
  })

  it('logout clears user and calls signOut', async () => {
    const { signOut } = await import('next-auth/react')
    useAuthStore.getState().setUser(testUser)
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  it('preserves user fields including optional ones', () => {
    const userWithAvatar: User = { ...testUser, avatar: 'https://example.com/avatar.png' }
    useAuthStore.getState().setUser(userWithAvatar)
    expect(useAuthStore.getState().user?.avatar).toBe('https://example.com/avatar.png')
  })
})
