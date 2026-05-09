import type { LanTransport } from './lan-transport'

/**
 * Singleton registry for the active LAN sync transport.
 *
 * The desktop app (or a browser served by the hub) discovers the hub
 * URL once on startup, creates a `LanTransport`, and registers it
 * here. The sync layer ([sync.ts](./sync.ts)) consults this registry
 * to fall back to LAN when cloud Supabase is unreachable.
 *
 * This module deliberately stays tiny — it owns no policy, just the
 * pointer.
 */

let active: LanTransport | null = null
const watchers = new Set<(t: LanTransport | null) => void>()

export function getLanTransport(): LanTransport | null {
  return active
}

export function setLanTransport(transport: LanTransport | null): void {
  if (active === transport) return
  active = transport
  for (const watcher of watchers) {
    try {
      watcher(transport)
    } catch (err) {
      // Watchers must not break the registry — log and move on.
      console.warn('[transport-router] watcher threw:', err)
    }
  }
}

export function watchLanTransport(cb: (t: LanTransport | null) => void): () => void {
  watchers.add(cb)
  return () => {
    watchers.delete(cb)
  }
}
