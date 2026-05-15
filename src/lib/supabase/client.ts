import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface BackendConfig {
  url: string
  anonKey: string
}

const LOCAL_STORAGE_KEY = 'hr_backend_config'

let resolvedConfig: BackendConfig | null = null
let clientInstance: SupabaseClient | null = null
let hubLocalMode = false

function isValidConfig(candidate: Partial<BackendConfig>): candidate is BackendConfig {
  if (typeof candidate.url !== 'string' || typeof candidate.anonKey !== 'string') return false
  const url = candidate.url
  const httpsOk = url.startsWith('https://')
  const devOk = url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')
  if (!httpsOk && !devOk) return false
  // Supabase anon keys are either legacy JWTs (start with `eyJ`) or the
  // newer publishable-key format (`sb_publishable_...`).
  return /^eyJ/.test(candidate.anonKey) || /^sb_publishable_/.test(candidate.anonKey)
}

function readLocalStorageConfig(): BackendConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BackendConfig>
    if (isValidConfig(parsed)) return { url: parsed.url, anonKey: parsed.anonKey }
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
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

async function readRemoteConfig(): Promise<BackendConfig | null | 'local-hub'> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/config.json', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<BackendConfig> & { mode?: string }
    if (data.mode === 'local-hub') return 'local-hub'
    if (isValidConfig(data)) return { url: data.url, anonKey: data.anonKey }
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
  if (fromRemote === 'local-hub') {
    hubLocalMode = true
    // Use a sentinel so hasBackendConfig() returns true, but no Supabase client is built.
    resolvedConfig = { url: '', anonKey: '' }
    return resolvedConfig
  }
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

export function isHubLocalMode(): boolean {
  return hubLocalMode
}

export function getBackendConfig(): BackendConfig | null {
  return resolvedConfig
}

export function saveBackendConfig(config: BackendConfig): void {
  if (!isValidConfig(config)) {
    throw new Error('Invalid backend config: url must be https and anonKey must be a Supabase key')
  }
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
  if (hubLocalMode) {
    throw new Error(
      'Supabase is not available in local-hub mode. Guard this call with isHubLocalMode().',
    )
  }
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
