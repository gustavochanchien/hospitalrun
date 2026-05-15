/**
 * Bridge to the Electron main process. The preload script exposes
 * `window.hospitalrunIPC` via contextBridge; in browser builds (web/PWA)
 * the property is absent, so `isDesktop()` returns false and feature
 * code can branch cleanly.
 *
 * Keep this module side-effect-free: it must be safe to import from
 * shared code that runs in both web and desktop builds.
 */

export type DesktopMode = 'solo' | 'hub'

export interface HubInfo {
  url: string
  hostname: string
  port: number
}

export interface BackupResult {
  destination: string
  filesCopied: string[]
  bytesCopied: number
  startedAt: number
  finishedAt: number
}

export interface RestoreResult {
  filesRestored: string[]
  bytesCopied: number
}

export interface BackupStatus {
  lastBackupAt: number | null
  lastDestination: string | null
  lastError: string | null
}

export interface UpdateDownloadedPayload {
  version: string
  releaseNotes?: string | null
  releaseDate?: string | null
}

export interface DesktopIPC {
  /** Returns the saved run mode persisted in Electron's userData. */
  getRunMode: () => Promise<DesktopMode | null>
  /** Persists the run mode to Electron's userData. */
  setRunMode: (mode: DesktopMode) => Promise<void>
  /**
   * Mirrors the renderer's saved Supabase config into the main process
   * so the hub HTTP server can hand it back to LAN clients via
   * /config.json.
   */
  setBackendConfig: (cfg: { url: string; anonKey: string } | null) => Promise<void>
  /** Starts the Hono HTTP server + mDNS broadcast. Idempotent. */
  startHub: () => Promise<HubInfo>
  /** Stops the Hono HTTP server + mDNS broadcast. Idempotent. */
  stopHub: () => Promise<void>
  /** Returns the LAN-shareable URL if the hub is running, else null. */
  getHubInfo: () => Promise<HubInfo | null>
  /** Opens a URL in the user's default browser (for Supabase signup, etc). */
  openExternal: (url: string) => Promise<void>
  /** App version (from package.json) — useful for diagnostics. */
  getAppVersion: () => Promise<string>
  /**
   * Run a backup of the hub's persistent state. If `targetParent` is
   * omitted, the user is prompted to pick a folder. Resolves null if
   * the user cancelled.
   */
  runBackup: (targetParent?: string) => Promise<BackupResult | null>
  /** Last backup status (timestamp, destination, error). */
  getBackupStatus: () => Promise<BackupStatus>
  /**
   * Restore hub state from a backup folder. If `sourceFolderPath` is
   * omitted, the user is prompted to pick the folder. Stops hub services,
   * copies files, then restarts. Resolves null if the user cancelled.
   */
  restoreBackup: (sourceFolderPath?: string) => Promise<RestoreResult | null>
  /**
   * Subscribe to "update downloaded" events from electron-updater.
   * Returns an unsubscribe function. The callback fires once per
   * downloaded update; on disposal the listener is removed.
   */
  onUpdateDownloaded: (cb: (info: UpdateDownloadedPayload) => void) => () => void
  /** Quit and install the downloaded update. No-op outside packaged builds. */
  installUpdate: () => Promise<void>
}

declare global {
  interface Window {
    hospitalrunIPC?: DesktopIPC
  }
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.hospitalrunIPC
}

export function getIPC(): DesktopIPC {
  if (typeof window === 'undefined' || !window.hospitalrunIPC) {
    throw new Error('Desktop IPC bridge not available — running in a browser?')
  }
  return window.hospitalrunIPC
}

/**
 * Open a URL in the user's default browser when running inside Electron;
 * fall back to `window.open` in a browser build (e.g. when the SPA is
 * accessed from a tablet via the LAN-served hub).
 */
export async function openExternal(url: string): Promise<void> {
  if (isDesktop()) {
    await getIPC().openExternal(url)
    return
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
