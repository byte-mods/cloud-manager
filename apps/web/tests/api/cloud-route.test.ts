import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// We import and test the handler functions directly
import { GET, POST } from '@/app/api/v1/cloud/[...slug]/route'

// Store original fetch
const originalFetch = globalThis.fetch

describe('cloud API route', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function makeRequest(url: string, options?: RequestInit): NextRequest {
    return new NextRequest(new URL(url, 'http://localhost:3000'), options)
  }

  function makeParams(slug: string[]): { params: Promise<{ slug: string[] }> } {
    return { params: Promise.resolve({ slug }) }
  }

  it('GET forwards to correct backend URL', async () => {
    const mockData = { instances: [{ id: 'i-123' }] }
    ;(globalThis.fetch as any).mockResolvedValue({
      json: () => Promise.resolve(mockData),
      status: 200,
    })

    const req = makeRequest('http://localhost:3000/api/v1/cloud/instances/list')
    const res = await GET(req, makeParams(['instances', 'list']))
    const data = await res.json()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/cloud/instances/list'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(data).toEqual(mockData)
    expect(res.status).toBe(200)
  })

  it('POST forwards body correctly', async () => {
    const responseData = { id: 'new-instance' }
    ;(globalThis.fetch as any).mockResolvedValue({
      json: () => Promise.resolve(responseData),
      status: 201,
    })

    const body = { instanceType: 't3.medium', region: 'us-east-1' }
    const req = makeRequest('http://localhost:3000/api/v1/cloud/instances/create', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, makeParams(['instances', 'create']))
    const data = await res.json()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/cloud/instances/create'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    )
    expect(data).toEqual(responseData)
    expect(res.status).toBe(201)
  })

  it('returns 503 when backend is down', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('ECONNREFUSED'))

    const req = makeRequest('http://localhost:3000/api/v1/cloud/instances/list')
    const res = await GET(req, makeParams(['instances', 'list']))
    const data = await res.json()

    expect(res.status).toBe(503)
    expect(data.error).toBe('Cloud service unavailable')
  })

  it('query parameters are forwarded', async () => {
    const mockData = { results: [] }
    ;(globalThis.fetch as any).mockResolvedValue({
      json: () => Promise.resolve(mockData),
      status: 200,
    })

    const req = makeRequest('http://localhost:3000/api/v1/cloud/instances?region=us-east-1&limit=10')
    await GET(req, makeParams(['instances']))

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('instances?region=us-east-1&limit=10'),
      expect.any(Object),
    )
  })

  it('forwards authorization headers', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      json: () => Promise.resolve({}),
      status: 200,
    })

    const req = makeRequest('http://localhost:3000/api/v1/cloud/test', {
      headers: {
        authorization: 'Bearer token-123',
        'x-cloud-region': 'us-east-1',
        'x-unrelated-header': 'should-be-dropped',
      },
    })

    await GET(req, makeParams(['test']))

    const callArgs = (globalThis.fetch as any).mock.calls[0]
    const headers = callArgs[1].headers
    expect(headers['authorization']).toBe('Bearer token-123')
    expect(headers['x-cloud-region']).toBe('us-east-1')
    expect(headers['x-unrelated-header']).toBeUndefined()
  })
})
