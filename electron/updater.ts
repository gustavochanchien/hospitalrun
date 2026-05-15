import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

export interface UpdateDownloadedPayload {
  version: string
  releaseNotes?: string | null
  releaseDate?: string | null
}

const UPDATE_DOWNLOADED_CHANNEL = 'desktop:update-downloaded'
const INSTALL_UPDATE_CHANNEL = 'desktop:installUpdate'

let installHandlerRegistered = false

/**
 * Auto-update via GitHub Releases. Configured via the `publish` block
 * in the project's `package.json` "build" config — see
 * https://www.electron.build/auto-update.
 *
 * When an update is downloaded, the main process forwards a message
 * to the renderer so it can show an in-app "Restart to update" banner;
 * the renderer calls `installUpdate()` (handled here) to apply it.
 *
 * Skipped silently in development (no auto-update during `electron:dev`).
 */
export function configureAutoUpdater(
  getMainWindow: () => BrowserWindow | null,
): void {
  registerInstallHandler()

  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = null

  autoUpdater.on('update-downloaded', (info) => {
    const payload: UpdateDownloadedPayload = {
      version: info.version,
      releaseNotes:
        typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
      releaseDate: info.releaseDate ?? null,
    }
    const win = getMainWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
    win?.webContents.send(UPDATE_DOWNLOADED_CHANNEL, payload)
  })

  autoUpdater.on('error', (err) => {
    // Log only — never user-facing for v1, since there's no clean
    // recovery and clinic users shouldn't be bothered. The next
    // launch will retry.
    console.warn('[updater] error:', err.message)
  })

  void autoUpdater.checkForUpdates().catch(() => {
    // Network error / no GitHub access / not a published version — fine.
  })
}

function registerInstallHandler(): void {
  if (installHandlerRegistered) return
  installHandlerRegistered = true
  ipcMain.handle(INSTALL_UPDATE_CHANNEL, () => {
    if (!app.isPackaged) return
    autoUpdater.quitAndInstall()
  })
}
