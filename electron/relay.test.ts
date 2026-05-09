// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import http from 'node:http'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { WebSocket } from 'ws'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/hr-test', getName: () => 'X', getVersion: () => '0.0.0' },
}))

import { attachRelay, type RelayHandle } from './relay'
import { openLogStore, type LogStore } from './log-store'
import type { AuthVerifier, VerifiedClaims } from './auth-verify'

interface ServerMsg {
  type: string
  [k: string]: unknown
}

let tmpDir: string
let server: http.Server
let serverPort: number
let logStore: LogStore
let relay: RelayHandle

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600

const stubVerifier: AuthVerifier = {
  async verify(token: string): Promise<VerifiedClaims> {
    // Tokens encode the claims directly: "user-id|org-id|role"
    const parts = token.split('|')
    if (parts.length !== 3 || parts.some((p) => !p)) {
      throw new Error('invalid token')
    }
    return { sub: parts[0]!, orgId: parts[1]!, role: parts[2]!, exp: FUTURE_EXP }
  },
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hr-relay-'))
  logStore = openLogStore(path.join(tmpDir, 'log.sqlite'))
  server = http.createServer()
  relay = attachRelay(server, { logStore, verifier: stubVerifier })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('server has no address')
  serverPort = addr.port
})

afterEach(async () => {
  await relay.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  logStore.close()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

interface MsgQueue {
  next: () => Promise<ServerMsg>
  /** Drains accumulated messages and stops queueing. */
  drain: () => ServerMsg[]
}

function attachQueue(ws: WebSocket): MsgQueue {
  const buffered: ServerMsg[] = []
  const waiters: Array<(m: ServerMsg) => void> = []
  const onMsg = (data: WebSocket.RawData) => {
    const msg = JSON.parse(data.toString('utf8')) as ServerMsg
    const w = waiters.shift()
    if (w) w(msg)
    else buffered.push(msg)
  }
  ws.on('message', onMsg)
  return {
    next: () =>
      new Promise<ServerMsg>((resolve) => {
        const queued = buffered.shift()
        if (queued) resolve(queued)
        else waiters.push(resolve)
      }),
    drain: () => {
      ws.off('message', onMsg)
      const all = buffered.slice()
      buffered.length = 0
      return all
    },
  }
}

interface OpenedWs {
  ws: WebSocket
  q: MsgQueue
}

function open(): Promise<OpenedWs> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/sync`)
    ws.once('open', () => {
      const q = attachQueue(ws)
      resolve({ ws, q })
    })
    ws.once('error', reject)
  })
}

function send(ws: WebSocket, msg: unknown) {
  ws.send(JSON.stringify(msg))
}

async function subscribeAndDrain(opened: OpenedWs, orgId: string, jwt: string): Promise<void> {
  send(opened.ws, { type: 'subscribe', orgId, jwt })
  const subscribed = await opened.q.next()
  if (subscribed.type !== 'subscribed') {
    throw new Error(`expected subscribed, got ${JSON.stringify(subscribed)}`)
  }
  // Drain replay messages until done:true
  while (true) {
    const m = await opened.q.next()
    if (m.type === 'replay' && m.done === true) return
    if (m.type === 'replay') continue
    throw new Error(`expected replay, got ${JSON.stringify(m)}`)
  }
}

const samplePatient = (id: string, orgId: string, updatedAt: string) => ({
  id,
  orgId,
  _table: 'patients',
  updatedAt,
  familyName: 'Doe',
  givenName: 'Jane',
})

describe('relay subscribe', () => {
  it('returns subscribed + empty replay for a fresh subscribe', async () => {
    const a = await open()
    send(a.ws, { type: 'subscribe', orgId: 'org-1', jwt: 'u1|org-1|admin' })
    expect(await a.q.next()).toEqual({ type: 'subscribed', headCursor: 0 })
    expect(await a.q.next()).toMatchObject({ type: 'replay', entries: [], done: true })
    a.ws.close()
  })

  it('rejects subscribe whose jwt orgId differs from message orgId', async () => {
    const a = await open()
    send(a.ws, { type: 'subscribe', orgId: 'org-2', jwt: 'u1|org-1|admin' })
    expect(await a.q.next()).toMatchObject({ type: 'error', code: 'auth/org-mismatch' })
    a.ws.close()
  })

  it('rejects subscribe with a bad jwt', async () => {
    const a = await open()
    send(a.ws, { type: 'subscribe', orgId: 'org-1', jwt: 'malformed' })
    expect(await a.q.next()).toMatchObject({ type: 'error', code: 'auth/invalid' })
    a.ws.close()
  })

  it('replays previously-stored entries for the org', async () => {
    logStore.appendIfNewer({
      orgId: 'org-1',
      tableName: 'patients',
      recordId: 'p1',
      updatedAt: '2026-01-01T00:00:00Z',
      record: samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    })
    const a = await open()
    send(a.ws, { type: 'subscribe', orgId: 'org-1', jwt: 'u1|org-1|admin' })
    await a.q.next() // subscribed
    const replay = await a.q.next()
    expect(replay.type).toBe('replay')
    expect((replay.entries as unknown[]).length).toBe(1)
    expect(replay.done).toBe(true)
    a.ws.close()
  })

  it('skips replay if sinceCursor is at head', async () => {
    const r = logStore.appendIfNewer({
      orgId: 'org-1',
      tableName: 'patients',
      recordId: 'p1',
      updatedAt: '2026-01-01T00:00:00Z',
      record: samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    })
    if (!('cursor' in r)) throw new Error('expected cursor')
    const a = await open()
    send(a.ws, { type: 'subscribe', orgId: 'org-1', jwt: 'u1|org-1|admin', sinceCursor: r.cursor })
    await a.q.next() // subscribed
    const replay = await a.q.next()
    expect(replay).toMatchObject({ type: 'replay', entries: [], done: true })
    a.ws.close()
  })
})

describe('relay write + broadcast', () => {
  it('rejects write before subscribe', async () => {
    const a = await open()
    send(a.ws, {
      type: 'write',
      clientWriteId: 'cw1',
      jwt: 'u1|org-1|admin',
      record: samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    })
    expect(await a.q.next()).toMatchObject({ type: 'error', code: 'auth/required' })
    a.ws.close()
  })

  it('acks a fresh write and broadcasts to peers in the same org', async () => {
    const alice = await open()
    const bob = await open()
    await subscribeAndDrain(alice, 'org-1', 'u1|org-1|admin')
    await subscribeAndDrain(bob, 'org-1', 'u2|org-1|nurse')

    send(alice.ws, {
      type: 'write',
      clientWriteId: 'cw1',
      jwt: 'u1|org-1|admin',
      record: samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    })
    const ack = await alice.q.next()
    expect(ack).toMatchObject({ type: 'ack', clientWriteId: 'cw1' })
    expect(typeof ack.cursor).toBe('number')

    const broadcast = await bob.q.next()
    expect(broadcast.type).toBe('broadcast')
    expect(broadcast.cursor).toBe(ack.cursor)
    expect((broadcast.record as { id: string }).id).toBe('p1')

    alice.ws.close()
    bob.ws.close()
  })

  it('does not broadcast to peers in a different org', async () => {
    const alice = await open()
    const bob = await open()
    await subscribeAndDrain(alice, 'org-1', 'u1|org-1|admin')
    await subscribeAndDrain(bob, 'org-2', 'u2|org-2|admin')

    send(alice.ws, {
      type: 'write',
      clientWriteId: 'cw1',
      jwt: 'u1|org-1|admin',
      record: samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    })
    await alice.q.next() // own ack

    // Give the relay time to *not* broadcast.
    await new Promise((r) => setTimeout(r, 80))
    const leaked = bob.q.drain()
    expect(leaked.find((m) => m.type === 'broadcast')).toBeUndefined()

    alice.ws.close()
    bob.ws.close()
  })

  it('rejects writes whose record.orgId differs from JWT org_id', async () => {
    const alice = await open()
    await subscribeAndDrain(alice, 'org-1', 'u1|org-1|admin')

    send(alice.ws, {
      type: 'write',
      clientWriteId: 'cw1',
      jwt: 'u1|org-1|admin',
      record: samplePatient('p1', 'org-OTHER', '2026-01-01T00:00:00Z'),
    })
    expect(await alice.q.next()).toMatchObject({ type: 'error', code: 'rls/org-mismatch' })
    alice.ws.close()
  })

  it('returns ack with skipped:true for an older duplicate write', async () => {
    const alice = await open()
    await subscribeAndDrain(alice, 'org-1', 'u1|org-1|admin')

    send(alice.ws, {
      type: 'write',
      clientWriteId: 'cw1',
      jwt: 'u1|org-1|admin',
      record: samplePatient('p1', 'org-1', '2026-01-02T00:00:00Z'),
    })
    await alice.q.next() // first ack

    send(alice.ws, {
      type: 'write',
      clientWriteId: 'cw2',
      jwt: 'u1|org-1|admin',
      record: samplePatient('p1', 'org-1', '2026-01-01T00:00:00Z'),
    })
    const ack2 = await alice.q.next()
    expect(ack2).toMatchObject({ type: 'ack', clientWriteId: 'cw2', cursor: null, skipped: true })
    alice.ws.close()
  })
})

describe('relay protocol errors', () => {
  it('responds to ping with pong', async () => {
    const a = await open()
    send(a.ws, { type: 'ping' })
    expect(await a.q.next()).toEqual({ type: 'pong' })
    a.ws.close()
  })

  it('returns bad-request for malformed JSON', async () => {
    const a = await open()
    a.ws.send('not json{{{')
    expect(await a.q.next()).toMatchObject({ type: 'error', code: 'protocol/bad-request' })
    a.ws.close()
  })

  it('returns bad-request for unknown message type', async () => {
    const a = await open()
    send(a.ws, { type: 'launch-missiles' })
    expect(await a.q.next()).toMatchObject({ type: 'error', code: 'protocol/bad-request' })
    a.ws.close()
  })

  it('rejects upgrade on wrong path', async () => {
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/wrong-path`)
      ws.on('error', () => resolve())
      ws.on('open', () => {
        ws.close()
        resolve()
      })
    })
  })
})
