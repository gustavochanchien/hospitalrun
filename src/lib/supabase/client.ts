import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface BackendConfig {
  url: string
  anonKey: string
}

const LOCAL_STORAGE_KEY = 'hr_backend_config'

let resolvedConfig: BackendConfig | null = null
let clientInstance: SupabaseClient | null = null

function readLocalStorageConfig(): BackendConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BackendConfig>
    if (typeof parsed.url === 'string' && typeof parsed.anonKey === 'string') {
      return { url: parsed.url, anonKey: parsed.anonKey }
    }
  } catch {
    // Corrupt entry — ignore and fall through.
  }
  return null
}

function readBuildTimeConfig(): BackendConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url && anonKey) return { url, anonKey }
  return null
}

async function readRemoteConfig(): Promise<BackendConfig | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/config.json', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<BackendConfig>
    if (typeof data.url === 'string' && typeof data.anonKey === 'string') {
      return { url: data.url, anonKey: data.anonKey }
    }
  } catch {
    // No /config.json served — fine, fall through to other sources.
  }
  return null
}

function buildClient(config: BackendConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

/**
 * Resolves and installs the backend config. Priority:
 *   1. localStorage (`hr_backend_config`) — set by the setup wizard.
 *   2. /config.json served by the origin — used by self-hosted deployments.
 *   3. Build-time env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 *
 * Call from main.tsx before mounting the router. Returns the resolved
 * config, or null if no source provided one (in which case the app must
 * route to /setup to collect it from the user).
 */
export async function initBackendConfig(): Promise<BackendConfig | null> {
  const fromLocal = readLocalStorageConfig()
  if (fromLocal) {
    resolvedConfig = fromLocal
    clientInstance = buildClient(fromLocal)
    return fromLocal
  }

  const fromRemote = await readRemoteConfig()
  if (fromRemote) {
    resolvedConfig = fromRemote
    clientInstance = buildClient(fromRemote)
    return fromRemote
  }

  const fromEnv = readBuildTimeConfig()
  if (fromEnv) {
    resolvedConfig = fromEnv
    clientInstance = buildClient(fromEnv)
    return fromEnv
  }

  return null
}

export function hasBackendConfig(): boolean {
  return resolvedConfig !== null
}

export function getBackendConfig(): BackendConfig | null {
  return resolvedConfig
}

export function saveBackendConfig(config: BackendConfig): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config))
  }
  resolvedConfig = config
  clientInstance = buildClient(config)
}

export function clearBackendConfig(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
  }
  resolvedConfig = null
  clientInstance = null
}

export function getSupabase(): SupabaseClient {
  if (!clientInstance) {
    throw new Error(
      'Supabase client not initialized. Call initBackendConfig() before accessing it, or send the user to /setup.',
    )
  }
  return clientInstance
}

/**
 * Backward-compatible live reference to the Supabase client.
 *
 * Any property access is forwarded to the client built by
 * initBackendConfig(). Keeping this export avoids rewriting ~80
 * existing callsites. It will throw if touched before
 * initBackendConfig() has resolved a config.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabase()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
  has(_target, prop) {
    return Reflect.has(getSupabase(), prop)
  },
})
