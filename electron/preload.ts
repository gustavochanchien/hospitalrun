import { contextBridge, ipcRenderer } from 'electron'

type RunMode = 'solo' | 'hub'

interface HubInfo {
  url: string
  hostname: string
  port: number
}

interface BackupResult {
  destination: string
  filesCopied: string[]
  bytesCopied: number
  startedAt: number
  finishedAt: number
}

interface RestoreResult {
  filesRestored: string[]
  bytesCopied: number
}

interface BackupStatus {
  lastBackupAt: number | null
  lastDestination: string | null
  lastError: string | null
}

interface DesktopIPC {
  getRunMode: () => Promise<RunMode | null>
  setRunMode: (mode: RunMode) => Promise<void>
  setBackendConfig: (cfg: { url: string; anonKey: string } | null) => Promise<void>
  startHub: () => Promise<HubInfo>
  stopHub: () => Promise<void>
  getHubInfo: () => Promise<HubInfo | null>
  openExternal: (url: string) => Promise<void>
  getAppVersion: () => Promise<string>
  runBackup: (targetParent?: string) => Promise<BackupResult | null>
  getBackupStatus: () => Promise<BackupStatus>
  restoreBackup: (sourceFolderPath?: string) => Promise<RestoreResult | null>
}

const api: DesktopIPC = {
  getRunMode: () => ipcRenderer.invoke('desktop:getRunMode'),
  setRunMode: (mode) => ipcRenderer.invoke('desktop:setRunMode', mode),
  setBackendConfig: (cfg) => ipcRenderer.invoke('desktop:setBackendConfig', cfg),
  startHub: () => ipcRenderer.invoke('desktop:startHub'),
  stopHub: () => ipcRenderer.invoke('desktop:stopHub'),
  getHubInfo: () => ipcRenderer.invoke('desktop:getHubInfo'),
  openExternal: (url) => ipcRenderer.invoke('desktop:openExternal', url),
  getAppVersion: () => ipcRenderer.invoke('desktop:getAppVersion'),
  runBackup: (targetParent) => ipcRenderer.invoke('desktop:runBackup', targetParent),
  getBackupStatus: () => ipcRenderer.invoke('desktop:getBackupStatus'),
  restoreBackup: (sourceFolderPath) => ipcRenderer.invoke('desktop:restoreBackup', sourceFolderPath),
}

contextBridge.exposeInMainWorld('hospitalrunIPC', api)
