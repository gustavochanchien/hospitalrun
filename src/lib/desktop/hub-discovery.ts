import { isDesktop, getIPC } from './env'

/**
 * Where does this client connect for LAN sync?
 *
 *  - Desktop in Hub mode: localhost (this same process is the hub).
 *  - Desktop in Solo mode: no hub.
 *  - Browser served by a hub: the same origin's `/sync` path.
 *  - Plain web build (Vercel etc): no hub.
 *
 * The browser path uses `/healthz` to confirm the origin is a
 * HospitalRun hub before attempting a WebSocket; this avoids spurious
 * connections when the SPA is served from a non-hub origin (Vercel,
 * Netlify, dev server, etc).
 */

export interface HubInfo {
  wsUrl: string
}

const HUB_PROBE_PATH = '/healthz'
const HUB_APP_NAME = 'HospitalRun'
const LOCAL_HUB_PORT = 5174

export async function discoverHub(): Promise<HubInfo | null> {
  if (typeof window === 'undefined') return null

  if (isDesktop()) {
    try {
      const mode = await getIPC().getRunMode()
      if (mode === 'hub') {
        return { wsUrl: `ws://localhost:${LOCAL_HUB_PORT}/sync` }
      }
    } catch {
      return null
    }
    return null
  }

  return probeOrigin()
}

async function probeOrigin(): Promise<HubInfo | null> {
  try {
    const res = await fetch(HUB_PROBE_PATH, { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { ok?: unknown; app?: unknown }
    if (body?.ok === true && body?.app === HUB_APP_NAME) {
      const wsScheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return { wsUrl: `${wsScheme}//${window.location.host}/sync` }
    }
  } catch {
    // No hub here; fine.
  }
  return null
}
