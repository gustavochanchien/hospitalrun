import type http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import type { LogStore } from './log-store.js'
import type { AuthVerifier, VerifiedClaims } from './auth-verify.js'

/**
 * LAN sync relay. WebSocket protocol on path `/sync`.
 *
 * Wire protocol (JSON over text frames):
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
 *
 * The server is authoritative. Writes are LWW-keyed by
 * (orgId, tableName, recordId) using `record.updatedAt`. RLS is
 * enforced in TypeScript: `record.orgId` MUST equal the JWT's
 * `org_id` claim, otherwise `error/rls-org-mismatch`.
 */

interface SubscribeMsg {
  type: 'subscribe'
  orgId: string
  jwt: string
  sinceCursor?: number
}
interface WriteMsg {
  type: 'write'
  clientWriteId: string
  jwt: string
  record: SyncableRecord
}
interface PingMsg {
  type: 'ping'
}
type ClientMsg = SubscribeMsg | WriteMsg | PingMsg

interface SyncableRecord {
  id: string
  orgId: string
  /** Dexie table name (camelCase, e.g. 'patients'). */
  _table: string
  updatedAt: string
  [k: string]: unknown
}

export interface RelayDeps {
  logStore: LogStore
  verifier: AuthVerifier
  /** Path to listen on. Default '/sync'. */
  path?: string
}

export interface RelayHandle {
  close(): Promise<void>
}

interface Peer {
  ws: WebSocket
  orgId: string | null
  sub: string | null
  subscribed: boolean
}

const REPLAY_BATCH = 200

const ERROR_CODES = {
  AUTH_REQUIRED: 'auth/required',
  AUTH_INVALID: 'auth/invalid',
  AUTH_ORG_MISMATCH: 'auth/org-mismatch',
  RLS_ORG_MISMATCH: 'rls/org-mismatch',
  BAD_REQUEST: 'protocol/bad-request',
  INTERNAL: 'internal',
} as const

export function attachRelay(server: http.Server, deps: RelayDeps): RelayHandle {
  const path = deps.path ?? '/sync'
  const wss = new WebSocketServer({ noServer: true })

  const peersByOrg = new Map<string, Set<Peer>>()

  function addPeer(peer: Peer) {
    if (!peer.orgId) return
    let set = peersByOrg.get(peer.orgId)
    if (!set) {
      set = new Set()
      peersByOrg.set(peer.orgId, set)
    }
    set.add(peer)
  }
  function removePeer(peer: Peer) {
    if (!peer.orgId) return
    const set = peersByOrg.get(peer.orgId)
    if (!set) return
    set.delete(peer)
    if (set.size === 0) peersByOrg.delete(peer.orgId)
  }
  function broadcastToOrg(orgId: string, msg: unknown, except?: Peer) {
    const set = peersByOrg.get(orgId)
    if (!set) return
    const text = JSON.stringify(msg)
    for (const peer of set) {
      if (peer === except) continue
      if (peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(text)
      }
    }
  }

  function send(peer: Peer, msg: unknown) {
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(JSON.stringify(msg))
    }
  }
  function sendError(peer: Peer, code: string, message: string, clientWriteId?: string) {
    send(peer, { type: 'error', code, message, ...(clientWriteId ? { clientWriteId } : {}) })
  }

  async function handleSubscribe(peer: Peer, msg: SubscribeMsg) {
    let claims: VerifiedClaims
    try {
      claims = await deps.verifier.verify(msg.jwt)
    } catch (err) {
      sendError(peer, ERROR_CODES.AUTH_INVALID, err instanceof Error ? err.message : 'invalid jwt')
      return
    }
    if (claims.orgId !== msg.orgId) {
      sendError(peer, ERROR_CODES.AUTH_ORG_MISMATCH, 'JWT org does not match subscribe org')
      return
    }
    peer.orgId = claims.orgId
    peer.sub = claims.sub
    peer.subscribed = true
    addPeer(peer)

    const headCursor = deps.logStore.head(claims.orgId)
    send(peer, { type: 'subscribed', headCursor })

    const since = msg.sinceCursor ?? 0
    if (since < headCursor) {
      const entries = deps.logStore.replaySince(claims.orgId, since)
      for (let i = 0; i < entries.length; i += REPLAY_BATCH) {
        const slice = entries.slice(i, i + REPLAY_BATCH)
        const done = i + REPLAY_BATCH >= entries.length
        send(peer, { type: 'replay', entries: slice, done })
      }
    } else {
      // Already up to date — send an empty done message so the client
      // knows replay is finished.
      send(peer, { type: 'replay', entries: [], done: true })
    }
  }

  async function handleWrite(peer: Peer, msg: WriteMsg) {
    let claims: VerifiedClaims
    try {
      claims = await deps.verifier.verify(msg.jwt)
    } catch (err) {
      sendError(peer, ERROR_CODES.AUTH_INVALID, err instanceof Error ? err.message : 'invalid jwt', msg.clientWriteId)
      return
    }
    if (!isSyncableRecord(msg.record)) {
      sendError(peer, ERROR_CODES.BAD_REQUEST, 'record missing required fields', msg.clientWriteId)
      return
    }
    if (msg.record.orgId !== claims.orgId) {
      sendError(peer, ERROR_CODES.RLS_ORG_MISMATCH, 'record.orgId does not match JWT org_id', msg.clientWriteId)
      return
    }

    let result
    try {
      result = deps.logStore.appendIfNewer({
        orgId: claims.orgId,
        tableName: msg.record._table,
        recordId: msg.record.id,
        updatedAt: msg.record.updatedAt,
        record: msg.record,
      })
    } catch (err) {
      sendError(peer, ERROR_CODES.INTERNAL, err instanceof Error ? err.message : 'append failed', msg.clientWriteId)
      return
    }

    if ('skipped' in result) {
      send(peer, {
        type: 'ack',
        clientWriteId: msg.clientWriteId,
        cursor: null,
        skipped: true,
      })
      return
    }

    send(peer, {
      type: 'ack',
      clientWriteId: msg.clientWriteId,
      cursor: result.cursor,
    })
    broadcastToOrg(
      claims.orgId,
      { type: 'broadcast', cursor: result.cursor, record: msg.record },
      peer,
    )
  }

  function handleMessage(peer: Peer, raw: string) {
    let msg: ClientMsg
    try {
      msg = JSON.parse(raw) as ClientMsg
    } catch {
      sendError(peer, ERROR_CODES.BAD_REQUEST, 'invalid JSON')
      return
    }
    if (typeof msg !== 'object' || msg === null || typeof msg.type !== 'string') {
      sendError(peer, ERROR_CODES.BAD_REQUEST, 'message missing type')
      return
    }
    switch (msg.type) {
      case 'subscribe':
        if (typeof msg.orgId !== 'string' || typeof msg.jwt !== 'string') {
          sendError(peer, ERROR_CODES.BAD_REQUEST, 'subscribe requires orgId + jwt')
          return
        }
        void handleSubscribe(peer, msg)
        return
      case 'write':
        if (
          typeof msg.clientWriteId !== 'string' ||
          typeof msg.jwt !== 'string' ||
          typeof msg.record !== 'object' ||
          msg.record === null
        ) {
          sendError(peer, ERROR_CODES.BAD_REQUEST, 'write malformed')
          return
        }
        if (!peer.subscribed) {
          sendError(peer, ERROR_CODES.AUTH_REQUIRED, 'must subscribe before writing')
          return
        }
        void handleWrite(peer, msg)
        return
      case 'ping':
        send(peer, { type: 'pong' })
        return
      default:
        sendError(peer, ERROR_CODES.BAD_REQUEST, `unknown type: ${(msg as { type: string }).type}`)
    }
  }

  wss.on('connection', (ws: WebSocket) => {
    const peer: Peer = { ws, orgId: null, sub: null, subscribed: false }
    ws.on('message', (data) => {
      const raw = typeof data === 'string' ? data : data.toString('utf8')
      handleMessage(peer, raw)
    })
    ws.on('close', () => removePeer(peer))
    ws.on('error', () => removePeer(peer))
  })

  function onUpgrade(req: http.IncomingMessage, socket: import('node:net').Socket, head: Buffer) {
    if (!req.url) {
      socket.destroy()
      return
    }
    const reqPath = req.url.split('?')[0]
    if (reqPath !== path) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  }

  server.on('upgrade', onUpgrade)

  return {
    async close() {
      server.off('upgrade', onUpgrade)
      for (const client of wss.clients) {
        try {
          client.close()
        } catch {
          // ignore
        }
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()))
    },
  }
}

function isSyncableRecord(v: unknown): v is SyncableRecord {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.orgId === 'string' &&
    typeof r._table === 'string' &&
    typeof r.updatedAt === 'string'
  )
}
