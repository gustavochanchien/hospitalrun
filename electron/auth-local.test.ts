// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  generateKeyPair,
  SignJWT,
  exportJWK,
  createLocalJWKSet,
  type JWK,
  type KeyLike,
} from 'jose'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/hr-test' },
}))

import { openAuthCache, type AuthCache } from './auth-cache'
import { loadOrCreateHubKeys, type HubKeySet } from './hub-keys'
import { createAuthLocalRouter } from './auth-local'
import {
  createCombinedVerifier,
  createVerifier,
  type AuthVerifier,
} from './auth-verify'

let tmpDir: string
let cache: AuthCache
let hubKeys: HubKeySet
// Stand-in for Supabase: a separate keypair that we'll use to sign
// "cloud" tokens for /auth/local/cache.
let cloudPrivate: KeyLike
let cloudPublicJwk: JWK
let cloudVerifier: AuthVerifier

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hr-authlocal-'))
  cache = openAuthCache(path.join(tmpDir, 'auth.sqlite'))
  hubKeys = await loadOrCreateHubKeys(path.join(tmpDir, 'hub-key.json'))

  const cloudPair = await generateKeyPair('RS256')
  cloudPrivate = cloudPair.privateKey
  cloudPublicJwk = await exportJWK(cloudPair.publicKey)
  cloudPublicJwk.alg = 'RS256'
  cloudPublicJwk.use = 'sig'
  cloudPublicJwk.kid = 'cloud-test-1'
  cloudVerifier = createVerifier(createLocalJWKSet({ keys: [cloudPublicJwk] }))
})

afterEach(async () => {
  cache.close()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

async function fakeCloudJwt(claims: Record<string, unknown>) {
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'cloud-test-1' })
    .setSubject((claims.sub as string | undefined) ?? 'user-1')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(cloudPrivate)
}

function buildRouter() {
  return createAuthLocalRouter({
    cache,
    signingKey: hubKeys.signingKey,
    publicJwk: hubKeys.publicJwk,
    kid: hubKeys.kid,
    cloudVerifier,
    tokenTtlSeconds: 3600,
  })
}

describe('auth-local /auth/local/jwks', () => {
  it('returns the hub public key', async () => {
    const router = buildRouter()
    const res = await router.fetch(new Request('http://hub.local/auth/local/jwks'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { keys: JWK[] }
    expect(body.keys).toHaveLength(1)
    expect(body.keys[0]?.kid).toBe(hubKeys.kid)
    expect(body.keys[0]?.alg).toBe('RS256')
  })
})

describe('auth-local /auth/local/cache', () => {
  it('rejects request without a valid cloud accessToken', async () => {
    const router = buildRouter()
    const res = await router.fetch(
      new Request('http://hub.local/auth/local/cache', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.c', password: 'x', accessToken: 'not-a-jwt' }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('caches a hash and profile when the cloud accessToken is valid', async () => {
    const router = buildRouter()
    const accessToken = await fakeCloudJwt({
      sub: 'user-42',
      org_id: 'org-7',
      role: 'doctor',
    })
    const res = await router.fetch(
      new Request('http://hub.local/auth/local/cache', {
        method: 'POST',
        body: JSON.stringify({ email: 'doc@example.com', password: 's3cret', accessToken }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(res.status).toBe(200)

    // Confirm the cache now lets them sign in offline
    const profile = cache.verify('doc@example.com', 's3cret')
    expect(profile?.userId).toBe('user-42')
    expect(profile?.orgId).toBe('org-7')
    expect(profile?.role).toBe('doctor')
  })

  it('returns 400 when payload is missing fields', async () => {
    const router = buildRouter()
    const res = await router.fetch(
      new Request('http://hub.local/auth/local/cache', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.c' }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('auth-local /auth/local/signin', () => {
  it('returns 401 for unknown email', async () => {
    const router = buildRouter()
    const res = await router.fetch(
      new Request('http://hub.local/auth/local/signin', {
        method: 'POST',
        body: JSON.stringify({ email: 'nobody@example.com', password: 'x' }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('issues a hub-signed JWT for a valid cached user', async () => {
    cache.populate('alice@example.com', 's3cret', {
      userId: 'user-alice',
      orgId: 'org-x',
      role: 'admin',
    })
    const router = buildRouter()
    const res = await router.fetch(
      new Request('http://hub.local/auth/local/signin', {
        method: 'POST',
        body: JSON.stringify({ email: 'alice@example.com', password: 's3cret' }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      accessToken: string
      profile: { userId: string; orgId: string; role: string }
    }
    expect(body.profile.userId).toBe('user-alice')

    // The issued token must verify with the hub's own JWKS
    const verifier = createVerifier(createLocalJWKSet({ keys: [hubKeys.publicJwk] }))
    const claims = await verifier.verify(body.accessToken)
    expect(claims.orgId).toBe('org-x')
    expect(claims.role).toBe('admin')
    expect(claims.sub).toBe('user-alice')
  })
})

describe('createCombinedVerifier', () => {
  it('accepts a hub-signed token via local JWKS', async () => {
    cache.populate('alice@example.com', 's3cret', {
      userId: 'user-1',
      orgId: 'org-1',
      role: 'admin',
    })
    const router = buildRouter()
    const res = await router.fetch(
      new Request('http://hub.local/auth/local/signin', {
        method: 'POST',
        body: JSON.stringify({ email: 'alice@example.com', password: 's3cret' }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    const { accessToken } = (await res.json()) as { accessToken: string }

    const combined = createCombinedVerifier({
      hubJwks: { keys: [hubKeys.publicJwk] },
    })
    const claims = await combined.verify(accessToken)
    expect(claims.orgId).toBe('org-1')
  })

  it('accepts a cloud-signed token via local JWKS provided as fixture', async () => {
    const cloudToken = await fakeCloudJwt({ sub: 'u', org_id: 'org-9', role: 'nurse' })
    const combined = createCombinedVerifier({
      hubJwks: { keys: [cloudPublicJwk, hubKeys.publicJwk] },
    })
    const claims = await combined.verify(cloudToken)
    expect(claims.orgId).toBe('org-9')
  })

  it('throws when no JWKS source is provided', () => {
    expect(() => createCombinedVerifier({})).toThrow(/at least one/)
  })
})
