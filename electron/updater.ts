import { app, BrowserWindow, dialog } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

/**
 * Auto-update via GitHub Releases. Configured via the `publish` block
 * in the project's `package.json` "build" config — see
 * https://www.electron.build/auto-update.
 *
 * Updates are checked once on launch; if one is available, downloaded
 * in the background, and the user is prompted before install. We never
 * apply updates without consent.
 *
 * Skipped silently in development (no auto-update during `electron:dev`).
 */
export function configureAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = null

  autoUpdater.on('update-downloaded', async (info) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showMessageBox(win ?? undefined!, {
      type: 'info',
      title: 'Update ready',
      message: `HospitalRun ${info.version} is ready to install.`,
      detail: 'Install now and restart, or wait until next launch.',
      buttons: ['Install and restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })
    if (result.response === 0) {
      autoUpdater.quitAndInstall()
    }
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
