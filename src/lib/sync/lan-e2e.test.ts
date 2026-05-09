// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import http from 'node:http'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { WebSocket as WsWebSocket } from 'ws'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/hr-test', getName: () => 'X', getVersion: () => '0.0.0' },
}))

import { attachRelay, type RelayHandle } from '../../../electron/relay'
import { openLogStore, type LogStore } from '../../../electron/log-store'
import type { AuthVerifier, VerifiedClaims } from '../../../electron/auth-verify'
import {
  createLanTransport,
  type LanTransport,
  type SyncableRecord,
  type WriteAck,
} from './lan-transport'

/**
 * End-to-end smoke test: spin up an in-process relay + log-store, run
 * two LAN-transport clients against it, and verify that:
 *
 *  - a write from device A appears as an inbound record on device B
 *  - LWW correctly suppresses an older write
 *  - A late-joining device C catches up via replay
 *  - Org isolation: a different-org device cannot see the writes
 */

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600

const verifier: AuthVerifier = {
  async verify(token: string): Promise<VerifiedClaims> {
    const parts = token.split('|')
    if (parts.length !== 3 || parts.some((p) => !p)) throw new Error('invalid')
    return { sub: parts[0]!, orgId: parts[1]!, role: parts[2]!, exp: FUTURE_EXP }
  },
}

let tmpDir: string
let server: http.Server
let serverPort: number
let logStore: LogStore
let relay: RelayHandle

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hr-e2e-'))
  logStore = openLogStore(path.join(tmpDir, 'log.sqlite'))
  server = http.createServer()
  relay = attachRelay(server, { logStore, verifier })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('no port')
  serverPort = addr.port
})

afterEach(async () => {
  await relay.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  logStore.close()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

interface Client {
  transport: LanTransport
  records: SyncableRecord[]
}

function spawn(jwt: string, orgId = 'org-1'): Client {
  const records: SyncableRecord[] = []
  const transport = createLanTransport({
    hubUrl: `ws://127.0.0.1:${serverPort}/sync`,
    orgId,
    getJwt: () => jwt,
    onRecord: (r) => records.push(r),
    webSocketCtor: WsWebSocket as unknown as typeof globalThis.WebSocket,
    backoffBaseMs: 50,
  })
  transport.start()
  return { transport, records }
}

async function waitFor<T>(check: () => T | null | undefined, timeoutMs = 2000): Promise<T> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const got = check()
    if (got) return got
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error('waitFor timed out')
}

const samplePatient = (id: string, orgId: string, updatedAt: string): SyncableRecord => ({
  id,
  orgId,
  _table: 'patients',
  updatedAt,
  familyName: 'Smith',
})

describe('LAN sync end-to-end', () => {
  it('two devices in the same org sync writes between each other', async () => {
    const alice = spawn('a|org-1|admin')
    const bob = spawn('b|org-1|nurse')
    await waitFor(() => alice.transport.state() === 'connected' || null)
    await waitFor(() => bob.transport.state() === 'connected' || null)

    const ack = (await alice.transport.writeRecord(
      samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    )) as WriteAck
    expect(ack.ok).toBe(true)

    await waitFor(() => bob.records.find((r) => r.id === 'p1') ?? null)
    const seen = bob.records.find((r) => r.id === 'p1')!
    expect(seen.familyName).toBe('Smith')
    expect(seen.orgId).toBe('org-1')

    alice.transport.stop()
    bob.transport.stop()
  })

  it('LWW: an older write does not overwrite the newer record', async () => {
    const alice = spawn('a|org-1|admin')
    await waitFor(() => alice.transport.state() === 'connected' || null)

    const ack1 = (await alice.transport.writeRecord(
      samplePatient('p1', 'org-1', '2026-01-02T00:00:00Z'),
    )) as WriteAck
    expect(ack1.ok).toBe(true)

    const ack2 = (await alice.transport.writeRecord(
      samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    )) as WriteAck
    expect(ack2.ok).toBe(true)
    if (ack2.ok) expect(ack2.skipped).toBe(true)

    alice.transport.stop()
  })

  it('a late-joining device catches up via replay', async () => {
    const alice = spawn('a|org-1|admin')
    await waitFor(() => alice.transport.state() === 'connected' || null)
    await alice.transport.writeRecord(samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'))
    await alice.transport.writeRecord(samplePatient('p2', 'org-1', '2026-01-02T00:00:00Z'))

    // New device joins after the writes have already happened
    const charlie = spawn('c|org-1|doctor')
    await waitFor(() =>
      charlie.records.find((r) => r.id === 'p1') &&
      charlie.records.find((r) => r.id === 'p2')
        ? true
        : null,
    )

    alice.transport.stop()
    charlie.transport.stop()
  })

  it('org isolation: different-org peers cannot see each other writes', async () => {
    const alice = spawn('a|org-1|admin', 'org-1')
    const evil = spawn('e|org-2|admin', 'org-2')
    await waitFor(() => alice.transport.state() === 'connected' || null)
    await waitFor(() => evil.transport.state() === 'connected' || null)

    const before = evil.records.length
    await alice.transport.writeRecord(samplePatient('secret-p1', 'org-1', '2026-01-01T00:00:00Z'))
    await new Promise((r) => setTimeout(r, 100))
    expect(evil.records.length).toBe(before)

    alice.transport.stop()
    evil.transport.stop()
  })

  it('rejects writes whose record.orgId does not match the JWT org_id', async () => {
    const alice = spawn('a|org-1|admin')
    await waitFor(() => alice.transport.state() === 'connected' || null)
    const ack = (await alice.transport.writeRecord(
      samplePatient('p1', 'org-attacker', '2026-01-01T00:00:00Z'),
    )) as WriteAck
    expect(ack.ok).toBe(false)
    if (!ack.ok) expect(ack.code).toBe('rls/org-mismatch')
    alice.transport.stop()
  })
})
