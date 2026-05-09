// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/hr-test' },
}))

import { openAuthCache, type AuthCache } from './auth-cache'

let tmpDir: string
let cache: AuthCache

const profile = { userId: 'user-1', orgId: 'org-1', role: 'admin' as const }

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hr-authcache-'))
  cache = openAuthCache(path.join(tmpDir, 'auth.sqlite'))
})

afterEach(async () => {
  cache.close()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('auth-cache', () => {
  it('returns null for an unknown email', () => {
    expect(cache.verify('nobody@example.com', 'whatever')).toBeNull()
  })

  it('verifies the correct password and returns the profile', () => {
    cache.populate('alice@example.com', 's3cret', profile)
    const result = cache.verify('alice@example.com', 's3cret')
    expect(result).not.toBeNull()
    expect(result?.userId).toBe('user-1')
    expect(result?.orgId).toBe('org-1')
    expect(result?.role).toBe('admin')
  })

  it('rejects the wrong password', () => {
    cache.populate('alice@example.com', 's3cret', profile)
    expect(cache.verify('alice@example.com', 'wrong')).toBeNull()
  })

  it('is case-insensitive for the email', () => {
    cache.populate('Alice@Example.com', 's3cret', profile)
    expect(cache.verify('alice@example.com', 's3cret')).not.toBeNull()
    expect(cache.verify('ALICE@EXAMPLE.COM', 's3cret')).not.toBeNull()
  })

  it('overwrites a previous entry on populate', () => {
    cache.populate('alice@example.com', 'old', profile)
    cache.populate('alice@example.com', 'new', { ...profile, role: 'doctor' })
    expect(cache.verify('alice@example.com', 'old')).toBeNull()
    const result = cache.verify('alice@example.com', 'new')
    expect(result?.role).toBe('doctor')
  })

  it('lookup returns the profile without verifying password', () => {
    cache.populate('alice@example.com', 's3cret', profile)
    const looked = cache.lookup('alice@example.com')
    expect(looked?.userId).toBe('user-1')
  })

  it('forget deletes an entry', () => {
    cache.populate('alice@example.com', 's3cret', profile)
    cache.forget('alice@example.com')
    expect(cache.lookup('alice@example.com')).toBeNull()
  })

  it('updates last_verified on successful verify', async () => {
    cache.populate('alice@example.com', 's3cret', profile)
    const first = cache.lookup('alice@example.com')!
    await new Promise((r) => setTimeout(r, 5))
    cache.verify('alice@example.com', 's3cret')
    const second = cache.lookup('alice@example.com')!
    expect(second.lastVerified).toBeGreaterThanOrEqual(first.lastVerified)
  })

  it('rejects an empty password on populate', () => {
    expect(() => cache.populate('alice@example.com', '', profile)).toThrow(/password/)
  })
})
