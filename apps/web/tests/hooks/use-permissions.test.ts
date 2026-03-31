import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

import { useAuthStore, type Role } from '@/stores/auth-store'
import { usePermissions, type Module } from '@/hooks/use-permissions'

function setRole(role: Role) {
  useAuthStore.setState({
    user: {
      id: '1',
      email: 'test@example.com',
      name: 'Test',
      role,
      mfaEnabled: false,
    },
    isAuthenticated: true,
    isLoading: false,
  })
}

function clearUser() {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
}

describe('usePermissions', () => {
  beforeEach(() => {
    clearUser()
  })

  // ---- cloud_architect has full access to all modules ----
  it('cloud_architect has full access to compute', () => {
    setRole('cloud_architect')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.can('read', 'compute')).toBe(true)
    expect(result.current.can('write', 'compute')).toBe(true)
  })

  it('cloud_architect has full access to all listed modules', () => {
    setRole('cloud_architect')
    const { result } = renderHook(() => usePermissions())
    const modules: Module[] = [
      'compute', 'storage', 'networking', 'databases', 'ai_ml',
      'security', 'security_testing', 'monitoring', 'devops', 'cost',
      'analytics', 'tutorials', 'ai_assistant', 'infrastructure', 'cloud_connect',
    ]
    for (const mod of modules) {
      expect(result.current.can('read', mod)).toBe(true)
      expect(result.current.can('write', mod)).toBe(true)
    }
  })

  it('cloud_architect role is returned correctly', () => {
    setRole('cloud_architect')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.role).toBe('cloud_architect')
  })

  // ---- network_admin has none for ai_ml ----
  it('network_admin has none for ai_ml', () => {
    setRole('network_admin')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.can('read', 'ai_ml')).toBe(false)
    expect(result.current.can('write', 'ai_ml')).toBe(false)
    expect(result.current.getPermission('ai_ml')).toBe('none')
  })

  it('network_admin has none for data_engineering', () => {
    setRole('network_admin')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.can('read', 'data_engineering')).toBe(false)
    expect(result.current.can('write', 'data_engineering')).toBe(false)
  })

  it('network_admin has full access to networking', () => {
    setRole('network_admin')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.can('read', 'networking')).toBe(true)
    expect(result.current.can('write', 'networking')).toBe(true)
    expect(result.current.getPermission('networking')).toBe('full')
  })

  // ---- can('read', 'compute') for each role ----
  it.each([
    ['cloud_architect', true],
    ['devops_engineer', true],
    ['data_engineer', true],
    ['system_admin', true],
    ['network_admin', true],
  ] as [Role, boolean][])('%s can read compute: %s', (role, expected) => {
    setRole(role)
    const { result } = renderHook(() => usePermissions())
    expect(result.current.can('read', 'compute')).toBe(expected)
  })

  // ---- can('write', 'compute') respects hierarchy ----
  it.each([
    ['cloud_architect', true],   // full -> can write
    ['devops_engineer', true],   // full -> can write
    ['data_engineer', false],    // read -> cannot write
    ['system_admin', true],      // full -> can write
    ['network_admin', false],    // read -> cannot write
  ] as [Role, boolean][])('%s can write compute: %s', (role, expected) => {
    setRole(role)
    const { result } = renderHook(() => usePermissions())
    expect(result.current.can('write', 'compute')).toBe(expected)
  })

  // ---- infrastructure and cloud_connect modules exist ----
  it('infrastructure module exists and is accessible', () => {
    setRole('cloud_architect')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.can('read', 'infrastructure')).toBe(true)
    expect(result.current.getPermission('infrastructure')).toBe('full')
  })

  it('cloud_connect module exists and is accessible', () => {
    setRole('cloud_architect')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.can('read', 'cloud_connect')).toBe(true)
    expect(result.current.getPermission('cloud_connect')).toBe('full')
  })

  // ---- no user -> no access ----
  it('returns null role and denies all access when no user', () => {
    clearUser()
    const { result } = renderHook(() => usePermissions())
    expect(result.current.role).toBeNull()
    expect(result.current.can('read', 'compute')).toBe(false)
    expect(result.current.can('write', 'compute')).toBe(false)
    expect(result.current.getPermission('compute')).toBe('none')
  })

  // ---- devops_engineer specifics ----
  it('devops_engineer has read-only for security', () => {
    setRole('devops_engineer')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.can('read', 'security')).toBe(true)
    expect(result.current.can('write', 'security')).toBe(false)
  })

  // ---- data_engineer specifics ----
  it('data_engineer has full data_engineering access', () => {
    setRole('data_engineer')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.can('read', 'data_engineering')).toBe(true)
    expect(result.current.can('write', 'data_engineering')).toBe(true)
    expect(result.current.getPermission('data_engineering')).toBe('full')
  })
})
