// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from 'vitest'
import {
  generateKeyPair,
  SignJWT,
  exportJWK,
  createLocalJWKSet,
  type JWK,
} from 'jose'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/hr-test', getName: () => 'X', getVersion: () => '0.0.0' },
}))

import {
  createVerifier,
  extractClaims,
  type AuthVerifier,
} from './auth-verify'

let publicJwk: JWK
let privateKey: CryptoKey
let verifier: AuthVerifier

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  publicJwk = await exportJWK(pair.publicKey)
  publicJwk.alg = 'RS256'
  publicJwk.use = 'sig'
  publicJwk.kid = 'test-key-1'
  const getKey = createLocalJWKSet({ keys: [publicJwk] })
  verifier = createVerifier(getKey)
})

async function sign(claims: Record<string, unknown>) {
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setSubject((claims.sub as string | undefined) ?? 'user-1')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)
}

describe('createVerifier', () => {
  it('verifies a valid JWT with top-level org_id + role', async () => {
    const token = await sign({ sub: 'user-abc', org_id: 'org-1', role: 'admin' })
    const claims = await verifier.verify(token)
    expect(claims).toMatchObject({ sub: 'user-abc', orgId: 'org-1', role: 'admin' })
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('verifies a JWT with claims under app_metadata', async () => {
    const token = await sign({
      sub: 'user-1',
      app_metadata: { org_id: 'org-9', role: 'doctor' },
    })
    const claims = await verifier.verify(token)
    expect(claims.orgId).toBe('org-9')
    expect(claims.role).toBe('doctor')
  })

  it('prefers top-level over app_metadata', async () => {
    const token = await sign({
      sub: 'user-1',
      org_id: 'org-top',
      role: 'admin',
      app_metadata: { org_id: 'org-meta', role: 'doctor' },
    })
    const claims = await verifier.verify(token)
    expect(claims.orgId).toBe('org-top')
    expect(claims.role).toBe('admin')
  })

  it('rejects a JWT signed with a different key', async () => {
    const otherPair = await generateKeyPair('RS256')
    const evil = await new SignJWT({ sub: 'u', org_id: 'o', role: 'admin' })
      .setProtectedHeader({ alg: 'RS256', kid: 'unknown' })
      .setExpirationTime('1h')
      .sign(otherPair.privateKey)
    await expect(verifier.verify(evil)).rejects.toThrow()
  })

  it('rejects an expired JWT', async () => {
    const expired = await new SignJWT({ sub: 'u', org_id: 'o', role: 'admin' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey)
    await expect(verifier.verify(expired)).rejects.toThrow()
  })

  it('rejects a JWT missing org_id', async () => {
    const token = await sign({ sub: 'u', role: 'admin' })
    await expect(verifier.verify(token)).rejects.toThrow(/org_id/)
  })

  it('rejects a JWT missing role', async () => {
    const token = await sign({ sub: 'u', org_id: 'o' })
    await expect(verifier.verify(token)).rejects.toThrow(/role/)
  })

  it('rejects an HS256 JWT (asymmetric only)', async () => {
    const secret = new TextEncoder().encode('shared-secret-shared-secret-shared-secret-32b')
    const hs = await new SignJWT({ sub: 'u', org_id: 'o', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-key-1' })
      .setExpirationTime('1h')
      .sign(secret)
    await expect(verifier.verify(hs)).rejects.toThrow()
  })
})

describe('extractClaims', () => {
  it('extracts top-level claims', () => {
    expect(
      extractClaims({ sub: 'u', exp: 1, org_id: 'o', role: 'admin' }),
    ).toEqual({ sub: 'u', exp: 1, orgId: 'o', role: 'admin' })
  })

  it('falls back to user_metadata when app_metadata is absent', () => {
    expect(
      extractClaims({
        sub: 'u',
        exp: 1,
        user_metadata: { org_id: 'o', role: 'doctor' },
      }),
    ).toEqual({ sub: 'u', exp: 1, orgId: 'o', role: 'doctor' })
  })

  it('throws if sub is not a string', () => {
    expect(() => extractClaims({ exp: 1, org_id: 'o', role: 'admin' })).toThrow(/sub/)
  })

  it('throws if exp is not a number', () => {
    expect(() => extractClaims({ sub: 'u', org_id: 'o', role: 'admin' })).toThrow(/exp/)
  })
})
