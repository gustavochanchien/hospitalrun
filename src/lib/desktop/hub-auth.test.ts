import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hubSignin, hubCachePassword } from './hub-auth'

const fetchSpy = vi.fn()
const originalFetch = globalThis.fetch

beforeEach(() => {
  fetchSpy.mockReset()
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('hubSignin', () => {
  it('returns the parsed signin result on success', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessToken: 't0k3n',
          issuer: 'hospitalrun-hub',
          profile: { userId: 'u', email: 'a@b.c', orgId: 'o', role: 'admin' },
        }),
        { status: 200 },
      ),
    )
    const got = await hubSignin('a@b.c', 'pw')
    expect(got?.accessToken).toBe('t0k3n')
    expect(got?.profile.orgId).toBe('o')
  })

  it('returns null on 401', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('unauthorised', { status: 401 }))
    expect(await hubSignin('a@b.c', 'pw')).toBeNull()
  })

  it('returns null on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('boom'))
    expect(await hubSignin('a@b.c', 'pw')).toBeNull()
  })
})

describe('hubCachePassword', () => {
  it('returns true on 200', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    expect(
      await hubCachePassword({ email: 'a@b.c', password: 'p', accessToken: 'jwt' }),
    ).toBe(true)
  })

  it('returns false on non-2xx', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('no', { status: 401 }))
    expect(
      await hubCachePassword({ email: 'a@b.c', password: 'p', accessToken: 'jwt' }),
    ).toBe(false)
  })

  it('returns false on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('boom'))
    expect(
      await hubCachePassword({ email: 'a@b.c', password: 'p', accessToken: 'jwt' }),
    ).toBe(false)
  })
})
