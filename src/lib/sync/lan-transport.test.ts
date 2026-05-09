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
} from './lan-transport'

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600

const stubVerifier: AuthVerifier = {
  async verify(token: string): Promise<VerifiedClaims> {
    if (token === 'BAD') throw new Error('invalid')
    const parts = token.split('|')
    if (parts.length !== 3 || parts.some((p) => !p)) throw new Error('invalid token')
    return { sub: parts[0]!, orgId: parts[1]!, role: parts[2]!, exp: FUTURE_EXP }
  },
}

let tmpDir: string
let server: http.Server
let serverPort: number
let logStore: LogStore
let relay: RelayHandle

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hr-lan-'))
  logStore = openLogStore(path.join(tmpDir, 'log.sqlite'))
  server = http.createServer()
  relay = attachRelay(server, { logStore, verifier: stubVerifier })
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

interface Harness {
  transport: LanTransport
  records: SyncableRecord[]
  states: string[]
}

function makeHarness(jwt: string, orgId = 'org-1'): Harness {
  const records: SyncableRecord[] = []
  const states: string[] = []
  const transport = createLanTransport({
    hubUrl: `ws://127.0.0.1:${serverPort}/sync`,
    orgId,
    getJwt: () => jwt,
    onRecord: (r) => records.push(r),
    onState: (s) => states.push(s),
    webSocketCtor: WsWebSocket as unknown as typeof globalThis.WebSocket,
    backoffBaseMs: 50,
  })
  return { transport, records, states }
}

async function waitFor<T>(check: () => T | null, timeoutMs = 2000): Promise<T> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const got = check()
    if (got !== null && got !== undefined) return got
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error('waitFor timed out')
}

const samplePatient = (id: string, orgId: string, updatedAt: string): SyncableRecord => ({
  id,
  orgId,
  _table: 'patients',
  updatedAt,
  familyName: 'Doe',
})

describe('lan-transport — connection lifecycle', () => {
  it('connects, subscribes, transitions to connected', async () => {
    const h = makeHarness('u1|org-1|admin')
    h.transport.start()
    await waitFor(() => (h.transport.state() === 'connected' ? true : null))
    expect(h.states).toContain('connecting')
    expect(h.states).toContain('connected')
    h.transport.stop()
  })

  it('replays existing log entries on subscribe', async () => {
    logStore.appendIfNewer({
      orgId: 'org-1',
      tableName: 'patients',
      recordId: 'p1',
      updatedAt: '2026-01-01T00:00:00Z',
      record: samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    })
    const h = makeHarness('u1|org-1|admin')
    h.transport.start()
    await waitFor(() => (h.records.length === 1 ? true : null))
    expect(h.records[0]?.id).toBe('p1')
    h.transport.stop()
  })

  it('transitions to auth-failed when JWT is bad and stops reconnecting', async () => {
    const h = makeHarness('BAD')
    h.transport.start()
    await waitFor(() => (h.transport.state() === 'auth-failed' ? true : null))
    // give it time to NOT reconnect
    await new Promise((r) => setTimeout(r, 200))
    expect(h.transport.state()).toBe('auth-failed')
    h.transport.stop()
  })
})

describe('lan-transport — writes', () => {
  it('writeRecord round-trips via the relay', async () => {
    const h = makeHarness('u1|org-1|admin')
    h.transport.start()
    await waitFor(() => (h.transport.state() === 'connected' ? true : null))

    const ack = await h.transport.writeRecord(
      samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    )
    expect(ack.ok).toBe(true)
    if (ack.ok) {
      expect(typeof ack.cursor).toBe('number')
      expect(ack.skipped).toBe(false)
    }
    h.transport.stop()
  })

  it('queued writes are sent on connect', async () => {
    const h = makeHarness('u1|org-1|admin')
    // call start AFTER queuing — the write should still go out
    h.transport.start()
    const promise = h.transport.writeRecord(
      samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    )
    const ack = await promise
    expect(ack.ok).toBe(true)
    h.transport.stop()
  })

  it('returns skipped:true ack when the write is older than stored', async () => {
    logStore.appendIfNewer({
      orgId: 'org-1',
      tableName: 'patients',
      recordId: 'p1',
      updatedAt: '2026-01-02T00:00:00Z',
      record: samplePatient('p1', 'org-1', '2026-01-02T00:00:00Z'),
    })
    const h = makeHarness('u1|org-1|admin')
    h.transport.start()
    await waitFor(() => (h.transport.state() === 'connected' ? true : null))
    const ack = await h.transport.writeRecord(
      samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    )
    expect(ack.ok).toBe(true)
    if (ack.ok) {
      expect(ack.skipped).toBe(true)
      expect(ack.cursor).toBeNull()
    }
    h.transport.stop()
  })

  it('peer broadcasts arrive as onRecord callbacks', async () => {
    const alice = makeHarness('u1|org-1|admin')
    const bob = makeHarness('u2|org-1|nurse')
    alice.transport.start()
    bob.transport.start()
    await waitFor(() => (alice.transport.state() === 'connected' ? true : null))
    await waitFor(() => (bob.transport.state() === 'connected' ? true : null))
    // discard initial empty replay records (none, but stable assertions)
    alice.records.length = 0
    bob.records.length = 0

    const aliceAck = await alice.transport.writeRecord(
      samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    )
    expect(aliceAck.ok).toBe(true)

    await waitFor(() => (bob.records.length > 0 ? true : null))
    expect(bob.records[0]?.id).toBe('p1')
    alice.transport.stop()
    bob.transport.stop()
  })
})
