import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/v1/security/[...slug]/route'

const originalFetch = globalThis.fetch

describe('security API route', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function makeRequest(url: string): NextRequest {
    return new NextRequest(new URL(url, 'http://localhost:3000'))
  }

  function makeParams(slug: string[]): { params: Promise<{ slug: string[] }> } {
    return { params: Promise.resolve({ slug }) }
  }

  it('GET forwards correctly when backend is up', async () => {
    const mockData = { users: [{ id: 'u-1' }] }
    ;(globalThis.fetch as any).mockResolvedValue({
      json: () => Promise.resolve(mockData),
      status: 200,
    })

    const req = makeRequest('http://localhost:3000/api/v1/security/iam/users')
    const res = await GET(req, makeParams(['iam', 'users']))
    const data = await res.json()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/security/iam/users'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(data).toEqual(mockData)
    expect(res.status).toBe(200)
  })

  it('returns fallback mock data for iam/users when backend is down', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('ECONNREFUSED'))

    const req = makeRequest('http://localhost:3000/api/v1/security/iam/users')
    const res = await GET(req, makeParams(['iam', 'users']))
    const data = await res.json()

    // Fallback returns 200 with mock data instead of 503
    expect(res.status).toBe(200)
    expect(data.users).toBeDefined()
    expect(Array.isArray(data.users)).toBe(true)
    expect(data.users.length).toBeGreaterThanOrEqual(4)
    expect(data.users[0]).toHaveProperty('id')
    expect(data.users[0]).toHaveProperty('name')
    expect(data.users[0]).toHaveProperty('email')
    expect(data.users[0]).toHaveProperty('role')
    expect(data.users[0]).toHaveProperty('provider')
    expect(data.users[0]).toHaveProperty('status')
  })

  it('returns fallback mock data for iam/policies when backend is down', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('ECONNREFUSED'))

    const req = makeRequest('http://localhost:3000/api/v1/security/iam')
    const res = await GET(req, makeParams(['iam']))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.policies).toBeDefined()
    expect(Array.isArray(data.policies)).toBe(true)
    expect(data.policies.length).toBeGreaterThanOrEqual(3)
  })

  it('returns fallback mock data for secrets when backend is down', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('ECONNREFUSED'))

    const req = makeRequest('http://localhost:3000/api/v1/security/secrets')
    const res = await GET(req, makeParams(['secrets']))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.secrets).toBeDefined()
    expect(Array.isArray(data.secrets)).toBe(true)
    expect(data.secrets.length).toBeGreaterThanOrEqual(4)
    expect(data.secrets[0]).toHaveProperty('id')
    expect(data.secrets[0]).toHaveProperty('name')
    expect(data.secrets[0]).toHaveProperty('type')
    expect(data.secrets[0]).toHaveProperty('provider')
  })

  it('returns fallback mock data for certificates when backend is down', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('ECONNREFUSED'))

    const req = makeRequest('http://localhost:3000/api/v1/security/certificates')
    const res = await GET(req, makeParams(['certificates']))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.certificates).toBeDefined()
    expect(Array.isArray(data.certificates)).toBe(true)
    expect(data.certificates.length).toBeGreaterThanOrEqual(3)
    expect(data.certificates[0]).toHaveProperty('domain')
    expect(data.certificates[0]).toHaveProperty('status')
  })

  it('returns fallback mock data for audit when backend is down', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('ECONNREFUSED'))

    const req = makeRequest('http://localhost:3000/api/v1/security/audit')
    const res = await GET(req, makeParams(['audit']))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.logs).toBeDefined()
    expect(Array.isArray(data.logs)).toBe(true)
    expect(data.logs.length).toBeGreaterThanOrEqual(4)
  })

  it('returns fallback mock data for vapt when backend is down', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('ECONNREFUSED'))

    const req = makeRequest('http://localhost:3000/api/v1/security/vapt')
    const res = await GET(req, makeParams(['vapt']))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.vulnerabilities).toBeDefined()
    expect(Array.isArray(data.vulnerabilities)).toBe(true)
    expect(data.vulnerabilities[0]).toHaveProperty('severity')
    expect(data.vulnerabilities[0]).toHaveProperty('title')
  })

  it('returns overview mock data for unknown resource when backend is down', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('ECONNREFUSED'))

    const req = makeRequest('http://localhost:3000/api/v1/security/overview')
    const res = await GET(req, makeParams(['overview']))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.overview).toBeDefined()
    expect(data.overview).toHaveProperty('activeUsers')
    expect(data.overview).toHaveProperty('openVulnerabilities')
    expect(data.overview).toHaveProperty('expiringCertificates')
    expect(data.overview).toHaveProperty('secretsNeedingRotation')
  })
})
