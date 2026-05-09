// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('electron', () => ({
  app: {
    getName: () => 'HospitalRun',
    getVersion: () => '0.0.0-test',
    getPath: () => '/tmp/hr-test',
  },
}))

import {
  contentTypeFor,
  createHubRouter,
  getCachedBackendConfig,
  safeResolveStatic,
  setBackendConfigForLan,
} from './server'

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'test-fixtures',
)

function makeRouter(cfg: { url: string; anonKey: string } | null = null) {
  setBackendConfigForLan(cfg)
  return createHubRouter({
    staticRoot: fixturesDir,
    getBackendConfig: () => getCachedBackendConfig(),
    appInfo: { name: 'HospitalRun', version: '0.0.0-test' },
  })
}

describe('createHubRouter', () => {
  beforeEach(() => {
    setBackendConfigForLan(null)
  })

  it('returns 503 from /config.json when no config is cached', async () => {
    const router = makeRouter(null)
    const res = await router.fetch(new Request('http://hub.local/config.json'))
    expect(res.status).toBe(503)
  })

  it('returns the config + no-store cache header when config is cached', async () => {
    const cfg = { url: 'https://x.supabase.co', anonKey: 'sb_publishable_test' }
    const router = makeRouter(cfg)
    const res = await router.fetch(new Request('http://hub.local/config.json'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual(cfg)
  })

  it('returns app info from /healthz', async () => {
    const router = makeRouter()
    const res = await router.fetch(new Request('http://hub.local/healthz'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; app: string; version: string }
    expect(body).toEqual({ ok: true, app: 'HospitalRun', version: '0.0.0-test' })
  })

  it('serves index.html at /', async () => {
    const router = makeRouter()
    const res = await router.fetch(new Request('http://hub.local/'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(await res.text()).toContain('fixture-index')
  })

  it('serves a real static file from staticRoot', async () => {
    const router = makeRouter()
    const res = await router.fetch(new Request('http://hub.local/asset.css'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/css/)
    expect(await res.text()).toContain('.fixture')
  })

  it('falls back to index.html for unknown SPA routes', async () => {
    const router = makeRouter()
    const res = await router.fetch(new Request('http://hub.local/patients/abc-123'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(await res.text()).toContain('fixture-index')
  })

  it('blocks path-traversal attempts', async () => {
    const router = makeRouter()
    const res = await router.fetch(new Request('http://hub.local/../package.json'))
    // Either Hono normalises the URL and the SPA fallback fires (200 + index.html),
    // or safeResolveStatic rejects and we get a 404. Either way we must NOT serve
    // package.json contents.
    if (res.status === 200) {
      expect(res.headers.get('content-type')).toMatch(/text\/html/)
      expect(await res.text()).not.toContain('"name"')
    } else {
      expect(res.status).toBe(404)
    }
  })
})

describe('safeResolveStatic', () => {
  it('rejects parent-dir traversal', () => {
    expect(safeResolveStatic(fixturesDir, '/../package.json')).toBeNull()
    expect(safeResolveStatic(fixturesDir, '/foo/../../package.json')).toBeNull()
  })

  it('rejects NUL byte', () => {
    expect(safeResolveStatic(fixturesDir, '/index.html\0')).toBeNull()
  })

  it('rejects sibling-prefix collision', () => {
    // If staticRoot = /tmp/foo, "/foo-bar/x" must NOT resolve into /tmp/foo-bar/x
    const sneaky = '/tmp/foo'
    expect(safeResolveStatic(sneaky, '/../foo-bar/x')).toBeNull()
  })

  it('resolves normal paths', () => {
    const got = safeResolveStatic(fixturesDir, '/index.html')
    expect(got).toBe(path.join(fixturesDir, 'index.html'))
  })
})

describe('contentTypeFor', () => {
  it('maps known extensions', () => {
    expect(contentTypeFor('.html')).toMatch(/text\/html/)
    expect(contentTypeFor('.js')).toMatch(/application\/javascript/)
    expect(contentTypeFor('.css')).toMatch(/text\/css/)
    expect(contentTypeFor('.json')).toMatch(/application\/json/)
    expect(contentTypeFor('.svg')).toBe('image/svg+xml')
    expect(contentTypeFor('.png')).toBe('image/png')
    expect(contentTypeFor('.woff2')).toBe('font/woff2')
    expect(contentTypeFor('.webmanifest')).toBe('application/manifest+json')
  })

  it('falls back to octet-stream for unknown extensions', () => {
    expect(contentTypeFor('.xyz')).toBe('application/octet-stream')
    expect(contentTypeFor('')).toBe('application/octet-stream')
  })
})
