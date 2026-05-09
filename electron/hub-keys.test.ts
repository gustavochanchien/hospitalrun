// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/hr-test' },
}))

import { loadOrCreateHubKeys } from './hub-keys'

let tmpDir: string
let keyFile: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hr-keys-'))
  keyFile = path.join(tmpDir, 'hub-signing-key.json')
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('loadOrCreateHubKeys', () => {
  it('generates a new keypair on first call', async () => {
    const keys = await loadOrCreateHubKeys(keyFile)
    expect(keys.kid).toMatch(/^hub-/)
    expect(keys.publicJwk.alg).toBe('RS256')
    expect(keys.publicJwk.use).toBe('sig')
    expect(keys.publicJwk.kid).toBe(keys.kid)
    expect(keys.signingKey).toBeDefined()
  })

  it('reuses persisted keys on a subsequent call', async () => {
    const a = await loadOrCreateHubKeys(keyFile)
    const b = await loadOrCreateHubKeys(keyFile)
    expect(a.kid).toBe(b.kid)
    expect(a.publicJwk.n).toBe(b.publicJwk.n)
  })

  it('writes the key file with restrictive permissions on Unix', async () => {
    if (process.platform === 'win32') return // chmod is not enforced on Windows
    await loadOrCreateHubKeys(keyFile)
    const stat = await fs.stat(keyFile)
    expect(stat.mode & 0o077).toBe(0)
  })
})
