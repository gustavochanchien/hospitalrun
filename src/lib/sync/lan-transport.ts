/**
 * Client-side WebSocket transport for the LAN sync relay.
 *
 * Wire protocol (mirror of `electron/relay.ts`):
 *
 * Client → Server:
 *   { type: 'subscribe',  orgId, jwt, sinceCursor? }
 *   { type: 'write',      clientWriteId, record, jwt }
 *   { type: 'ping' }
 *
 * Server → Client:
 *   { type: 'subscribed', headCursor }
 *   { type: 'replay',     entries: [{cursor, record}, …], done }
 *   { type: 'broadcast',  cursor, record }
 *   { type: 'ack',        clientWriteId, cursor | null, skipped? }
 *   { type: 'error',      code, message }
 *   { type: 'pong' }
 */

export interface SyncableRecord {
  id: string
  orgId: string
  /** Dexie table name (camelCase). */
  _table: string
  updatedAt: string
  [k: string]: unknown
}

export type LanState = 'disconnected' | 'connecting' | 'connected' | 'auth-failed'

export interface WriteResult {
  ok: true
  cursor: number | null
  skipped: boolean
}
export interface WriteFailure {
  ok: false
  code: string
  message: string
}
export type WriteAck = WriteResult | WriteFailure

export interface LanTransportOptions {
  /** WebSocket URL ending in `/sync`. */
  hubUrl: string
  orgId: string
  /** Called to fetch the current JWT for each subscribe + write. */
  getJwt: () => string | null
  /** Called for every server-side write (replay or broadcast). */
  onRecord: (record: SyncableRecord) => void
  /** Called when state transitions. */
  onState?: (state: LanState) => void
  /** Optional WebSocket constructor override (for tests). */
  webSocketCtor?: typeof globalThis.WebSocket
  /**
   * Optional cursor persistence. If provided, the transport will read the
   * last-seen cursor on start and write to it on each new message
   * (debounced).
   */
  loadCursor?: () => number
  saveCursor?: (cursor: number) => void
  /** Backoff base in ms (default 250). */
  backoffBaseMs?: number
  /** Backoff cap in ms (default 30_000). */
  backoffCapMs?: number
}

export interface LanTransport {
  start(): void
  stop(): void
  state(): LanState
  /** Returns the cursor of the last applied message (replay or broadcast). */
  cursor(): number
  /** Send a write; resolves with the server's ack. */
  writeRecord(record: SyncableRecord): Promise<WriteAck>
}

interface PendingWrite {
  clientWriteId: string
  resolve: (ack: WriteAck) => void
  record: SyncableRecord
  retries: number
}

const SUBSCRIBE_TIMEOUT_MS = 10_000
const WRITE_TIMEOUT_MS = 15_000

export function createLanTransport(opts: LanTransportOptions): LanTransport {
  const WSCtor = opts.webSocketCtor ?? globalThis.WebSocket
  const backoffBase = opts.backoffBaseMs ?? 250
  const backoffCap = opts.backoffCapMs ?? 30_000

  let ws: WebSocket | null = null
  let state: LanState = 'disconnected'
  let started = false
  let attempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let writeIdSeq = 1
  const pending = new Map<string, PendingWrite>()
  /** Writes queued while disconnected, flushed in order on (re)connect. */
  const outbound: Array<PendingWrite> = []

  let lastCursor = opts.loadCursor ? opts.loadCursor() : 0
  let cursorSaveTimer: ReturnType<typeof setTimeout> | null = null

  function setState(next: LanState) {
    if (next === state) return
    state = next
    opts.onState?.(state)
  }

  function persistCursorSoon() {
    if (!opts.saveCursor) return
    if (cursorSaveTimer) return
    cursorSaveTimer = setTimeout(() => {
      cursorSaveTimer = null
      opts.saveCursor?.(lastCursor)
    }, 500)
  }

  function nextClientWriteId(): string {
    return `cw-${Date.now().toString(36)}-${(writeIdSeq++).toString(36)}`
  }

  function failPending(code: string, message: string) {
    for (const p of pending.values()) {
      p.resolve({ ok: false, code, message })
    }
    pending.clear()
    for (const p of outbound) {
      p.resolve({ ok: false, code, message })
    }
    outbound.length = 0
  }

  function scheduleReconnect() {
    if (!started) return
    if (state === 'auth-failed') return
    setState('disconnected')
    if (reconnectTimer) return
    const delay = Math.min(backoffCap, backoffBase * 2 ** Math.min(attempt, 16))
    attempt++
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function send(msg: unknown) {
    if (!ws || ws.readyState !== WSCtor.OPEN) return false
    ws.send(JSON.stringify(msg))
    return true
  }

  function flushOutbound() {
    while (outbound.length > 0) {
      const p = outbound.shift()!
      pending.set(p.clientWriteId, p)
      const jwt = opts.getJwt()
      if (!jwt) {
        p.resolve({ ok: false, code: 'auth/required', message: 'no jwt available' })
        pending.delete(p.clientWriteId)
        continue
      }
      const sent = send({
        type: 'write',
        clientWriteId: p.clientWriteId,
        jwt,
        record: p.record,
      })
      if (!sent) {
        // Connection dropped mid-flush; requeue
        outbound.unshift(p)
        pending.delete(p.clientWriteId)
        return
      }
      // Per-write timeout — protects against a server that ack'd nothing.
      setTimeout(() => {
        const stillPending = pending.get(p.clientWriteId)
        if (!stillPending) return
        pending.delete(p.clientWriteId)
        stillPending.resolve({ ok: false, code: 'timeout', message: 'no ack within deadline' })
      }, WRITE_TIMEOUT_MS)
    }
  }

  function connect() {
    if (!started) return
    setState('connecting')
    let socket: WebSocket
    try {
      socket = new WSCtor(opts.hubUrl)
    } catch (err) {
      void err
      scheduleReconnect()
      return
    }
    ws = socket

    let subscribeAcked = false
    const subscribeTimeout = setTimeout(() => {
      if (!subscribeAcked) {
        try {
          socket.close()
        } catch {
          // ignore
        }
      }
    }, SUBSCRIBE_TIMEOUT_MS)

    socket.addEventListener('open', () => {
      const jwt = opts.getJwt()
      if (!jwt) {
        setState('auth-failed')
        try {
          socket.close()
        } catch {
          // ignore
        }
        return
      }
      send({ type: 'subscribe', orgId: opts.orgId, jwt, sinceCursor: lastCursor })
    })

    socket.addEventListener('message', (event: MessageEvent) => {
      const raw = typeof event.data === 'string' ? event.data : ''
      let msg: { type: string; [k: string]: unknown }
      try {
        msg = JSON.parse(raw) as { type: string }
      } catch {
        return
      }
      switch (msg.type) {
        case 'subscribed': {
          subscribeAcked = true
          clearTimeout(subscribeTimeout)
          attempt = 0
          setState('connected')
          flushOutbound()
          return
        }
        case 'replay': {
          const entries = (msg.entries ?? []) as Array<{ cursor: number; record: SyncableRecord }>
          for (const entry of entries) {
            opts.onRecord(entry.record)
            if (entry.cursor > lastCursor) lastCursor = entry.cursor
          }
          if (entries.length > 0) persistCursorSoon()
          return
        }
        case 'broadcast': {
          const cursor = msg.cursor as number
          const record = msg.record as SyncableRecord
          if (record) opts.onRecord(record)
          if (typeof cursor === 'number' && cursor > lastCursor) {
            lastCursor = cursor
            persistCursorSoon()
          }
          return
        }
        case 'ack': {
          const id = msg.clientWriteId as string
          const p = pending.get(id)
          if (!p) return
          pending.delete(id)
          const cursor = (msg.cursor ?? null) as number | null
          const skipped = msg.skipped === true
          p.resolve({ ok: true, cursor, skipped })
          if (typeof cursor === 'number' && cursor > lastCursor) {
            lastCursor = cursor
            persistCursorSoon()
          }
          return
        }
        case 'error': {
          const code = String(msg.code ?? 'unknown')
          const message = String(msg.message ?? '')
          const clientWriteId = typeof msg.clientWriteId === 'string' ? msg.clientWriteId : null
          if (clientWriteId) {
            const p = pending.get(clientWriteId)
            if (p) {
              pending.delete(clientWriteId)
              p.resolve({ ok: false, code, message })
            }
          }
          if (code === 'auth/invalid' || code === 'auth/org-mismatch' || code === 'auth/required') {
            setState('auth-failed')
            failPending(code, message)
            try {
              socket.close()
            } catch {
              // ignore
            }
          }
          return
        }
        case 'pong':
          return
      }
    })

    socket.addEventListener('close', () => {
      clearTimeout(subscribeTimeout)
      ws = null
      // Move pending writes back into outbound for the next connection.
      for (const p of pending.values()) {
        outbound.push(p)
      }
      pending.clear()
      scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      // The 'close' event always follows; backoff happens there.
    })
  }

  return {
    start() {
      if (started) return
      started = true
      attempt = 0
      connect()
    },
    stop() {
      started = false
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      try {
        ws?.close()
      } catch {
        // ignore
      }
      ws = null
      failPending('stopped', 'transport stopped')
      setState('disconnected')
    },
    state() {
      return state
    },
    cursor() {
      return lastCursor
    },
    writeRecord(record): Promise<WriteAck> {
      return new Promise<WriteAck>((resolve) => {
        const entry: PendingWrite = {
          clientWriteId: nextClientWriteId(),
          resolve,
          record,
          retries: 0,
        }
        if (state === 'connected' && ws && ws.readyState === WSCtor.OPEN) {
          outbound.push(entry)
          flushOutbound()
        } else {
          // Queue until next connection
          outbound.push(entry)
        }
      })
    },
  }
}
