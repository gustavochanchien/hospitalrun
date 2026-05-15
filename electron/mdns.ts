import os from 'node:os'
import { Bonjour, type Service } from 'bonjour-service'

let bonjour: Bonjour | null = null
let advertised: Service | null = null

export const MDNS_HOSTNAME = 'hospitalrun.local'

export interface MdnsHandle {
  hostname: string
  port: number
}

/**
 * Advertise the hub on the LAN as `hospitalrun.local` (best-effort).
 * mDNS naming is not guaranteed to be honored by every router/OS — we
 * also fall back to the host's IP address in `getLanFallbackUrl`.
 */
export function startMdns(port: number): MdnsHandle {
  if (advertised) return { hostname: MDNS_HOSTNAME, port }

  bonjour ??= new Bonjour()
  advertised = bonjour.publish({
    name: 'HospitalRun',
    type: 'http',
    port,
    host: MDNS_HOSTNAME,
    txt: { app: 'hospitalrun', version: process.env.npm_package_version ?? 'dev' },
  })

  return { hostname: MDNS_HOSTNAME, port }
}

export function stopMdns(): void {
  if (advertised) {
    advertised.stop?.()
    advertised = null
  }
  if (bonjour) {
    bonjour.unpublishAll(() => {})
    bonjour.destroy()
    bonjour = null
  }
}

/**
 * Find a non-internal IPv4 address. Falls back to 'localhost' if nothing
 * usable is found. We prefer this for the user-visible "share this URL"
 * because mDNS resolution is unreliable across Windows / iOS / older
 * Android, while raw IPs always work on a flat LAN.
 */
export function getLanIp(): string {
  const ifaces = os.networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    const addrs = ifaces[name]
    if (!addrs) continue
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address
      }
    }
  }
  return 'localhost'
}
