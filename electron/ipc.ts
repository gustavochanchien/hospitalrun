import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { getRunMode, setRunMode, type RunMode } from './run-mode-store.js'
import {
  setBackendConfigForLan,
  startHubServer,
  stopHubServer,
} from './server.js'
import { getLanIp, startMdns, stopMdns } from './mdns.js'
import { defaultLogStorePath, openLogStore, type LogStore } from './log-store.js'
import { defaultAuthCachePath, openAuthCache, type AuthCache } from './auth-cache.js'
import { loadOrCreateHubKeys, type HubKeySet } from './hub-keys.js'
import { createAuthLocalRouter } from './auth-local.js'
import {
  createCombinedVerifier,
  createSupabaseVerifier,
  type AuthVerifier,
} from './auth-verify.js'
import { attachRelay, type RelayHandle } from './relay.js'
import { readStatus as readBackupStatus, runBackup, restoreFromBackup, type BackupResult, type BackupStatus, type RestoreResult } from './backup.js'

export interface HubInfo {
  url: string
  hostname: string
  port: number
}

interface BackendConfig {
  url: string
  anonKey: string
}

let lastHubInfo: HubInfo | null = null

// Hub-side singletons. Initialized lazily on the first startHub call so
// they are not created in Solo mode (where the hub never runs).
let logStore: LogStore | null = null
let authCache: AuthCache | null = null
let hubKeys: HubKeySet | null = null

let httpHandle: Awaited<ReturnType<typeof startHubServer>> | null = null
let relayHandle: RelayHandle | null = null
let cachedBackend: BackendConfig | null = null

async function ensureHubResources(): Promise<{
  logStore: LogStore
  authCache: AuthCache
  hubKeys: HubKeySet
}> {
  if (!logStore) logStore = openLogStore(defaultLogStorePath())
  if (!authCache) authCache = openAuthCache(defaultAuthCachePath())
  if (!hubKeys) hubKeys = await loadOrCreateHubKeys()
  return { logStore, authCache, hubKeys }
}

function buildVerifier(
  hubKeysIn: HubKeySet,
  backend: BackendConfig | null,
): AuthVerifier {
  if (backend) {
    return createCombinedVerifier({
      supabaseUrl: backend.url,
      hubJwks: { keys: [hubKeysIn.publicJwk] },
    })
  }
  // No cloud configured yet — only hub-issued JWTs are accepted.
  return createCombinedVerifier({
    hubJwks: { keys: [hubKeysIn.publicJwk] },
  })
}

async function startRelayIfReady(): Promise<void> {
  if (relayHandle) return
  if (!httpHandle) return
  const { logStore: ls, hubKeys: hk } = await ensureHubResources()
  const verifier = buildVerifier(hk, cachedBackend)
  relayHandle = attachRelay(httpHandle.server, { logStore: ls, verifier })
}

async function stopRelay(): Promise<void> {
  if (!relayHandle) return
  await relayHandle.close()
  relayHandle = null
}

async function startHub(): Promise<HubInfo> {
  const { authCache: ac, hubKeys: hk } = await ensureHubResources()
  const cloudVerifier = cachedBackend ? createSupabaseVerifier(cachedBackend.url) : null
  const authRouter = createAuthLocalRouter({
    cache: ac,
    signingKey: hk.signingKey,
    publicJwk: hk.publicJwk,
    kid: hk.kid,
    cloudVerifier,
  })

  if (!httpHandle) {
    httpHandle = await startHubServer({ authRouter })
  }
  startMdns(httpHandle.port)
  await startRelayIfReady()

  const ip = getLanIp()
  const info: HubInfo = {
    hostname: ip,
    port: httpHandle.port,
    url: `http://${ip}:${httpHandle.port}`,
  }
  lastHubInfo = info
  return info
}

async function stopHub(): Promise<void> {
  stopMdns()
  await stopRelay()
  await stopHubServer()
  httpHandle = null
  lastHubInfo = null
}

export function registerIpcHandlers(): void {
  ipcMain.handle('desktop:getRunMode', async (): Promise<RunMode | null> => {
    return getRunMode()
  })

  ipcMain.handle('desktop:setRunMode', async (_evt, mode: RunMode) => {
    if (mode !== 'solo' && mode !== 'hub') {
      throw new Error(`Invalid run mode: ${String(mode)}`)
    }
    await setRunMode(mode)
  })

  ipcMain.handle(
    'desktop:setBackendConfig',
    async (_evt, cfg: BackendConfig | null) => {
      cachedBackend = cfg
      setBackendConfigForLan(cfg)
      // If the hub is already running but the relay was waiting on
      // the cloud Supabase URL, start it now.
      if (httpHandle && cfg && !relayHandle) {
        await startRelayIfReady()
      }
    },
  )

  ipcMain.handle('desktop:startHub', async (): Promise<HubInfo> => {
    return startHub()
  })

  ipcMain.handle('desktop:stopHub', async (): Promise<void> => {
    await stopHub()
  })

  ipcMain.handle('desktop:getHubInfo', async (): Promise<HubInfo | null> => {
    return lastHubInfo
  })

  ipcMain.handle('desktop:openExternal', async (_evt, url: string) => {
    if (typeof url !== 'string') throw new Error('url must be a string')
    if (!/^https?:\/\//.test(url)) throw new Error('Only http/https URLs are allowed')
    await shell.openExternal(url)
  })

  ipcMain.handle('desktop:getAppVersion', async (): Promise<string> => {
    return app.getVersion()
  })

  ipcMain.handle(
    'desktop:runBackup',
    async (_evt, targetParent?: string): Promise<BackupResult | null> => {
      let parent = targetParent
      if (!parent) {
        const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
        const result = win
          ? await dialog.showOpenDialog(win, {
              title: 'Choose where to save the HospitalRun backup',
              properties: ['openDirectory', 'createDirectory'],
            })
          : await dialog.showOpenDialog({
              properties: ['openDirectory', 'createDirectory'],
            })
        if (result.canceled || result.filePaths.length === 0) return null
        parent = result.filePaths[0]!
      }
      return runBackup(parent)
    },
  )

  ipcMain.handle('desktop:getBackupStatus', async (): Promise<BackupStatus> => {
    return readBackupStatus()
  })

  ipcMain.handle(
    'desktop:restoreBackup',
    async (_evt, sourceFolderOverride?: string): Promise<RestoreResult | null> => {
      let source = sourceFolderOverride
      if (!source) {
        const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
        const result = win
          ? await dialog.showOpenDialog(win, {
              title: 'Choose the HospitalRun backup folder to restore',
              properties: ['openDirectory'],
            })
          : await dialog.showOpenDialog({ properties: ['openDirectory'] })
        if (result.canceled || result.filePaths.length === 0) return null
        source = result.filePaths[0]!
      }

      // Stop hub services before overwriting the files they hold open.
      await stopHub()
      if (logStore) { logStore.close(); logStore = null }
      if (authCache) { authCache.close(); authCache = null }
      hubKeys = null

      const restoreResult = await restoreFromBackup(source)

      // Restart hub if it was running in hub mode.
      const mode = await getRunMode()
      if (mode === 'hub') await startHub()

      return restoreResult
    },
  )
}

export async function autoStartHubIfConfigured(): Promise<HubInfo | null> {
  const mode = await getRunMode()
  if (mode === 'hub') {
    return startHub()
  }
  return null
}

export async function shutdownDesktopServices(): Promise<void> {
  await stopHub()
  if (logStore) {
    logStore.close()
    logStore = null
  }
  if (authCache) {
    authCache.close()
    authCache = null
  }
}
