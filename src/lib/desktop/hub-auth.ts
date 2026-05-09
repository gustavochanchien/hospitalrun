/**
 * Client-side helpers for the hub's offline auth endpoints. These hit
 * the same origin the SPA was served from (when running on a tablet
 * connected to a hub) or `http://localhost:5174` (when running inside
 * the desktop hub itself).
 *
 * Phase 3 surface only — Phase 4 will add HTTPS handling.
 */

import { isDesktop } from './env'

export interface HubProfile {
  userId: string
  email: string
  orgId: string
  role: string
}

export interface HubSigninResult {
  accessToken: string
  issuer: string
  profile: HubProfile
}

const LOCAL_HUB_ORIGIN = 'http://localhost:5174'

function hubOrigin(): string {
  if (typeof window === 'undefined') return LOCAL_HUB_ORIGIN
  if (isDesktop()) return LOCAL_HUB_ORIGIN
  return window.location.origin
}

export async function hubSignin(email: string, password: string): Promise<HubSigninResult | null> {
  try {
    const res = await fetch(`${hubOrigin()}/auth/local/signin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) return null
    return (await res.json()) as HubSigninResult
  } catch {
    return null
  }
}

export async function hubCachePassword(args: {
  email: string
  password: string
  accessToken: string
}): Promise<boolean> {
  try {
    const res = await fetch(`${hubOrigin()}/auth/local/cache`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args),
    })
    return res.ok
  } catch {
    return false
  }
}
