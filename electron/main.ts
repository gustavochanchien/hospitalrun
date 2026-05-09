import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'
import {
  autoStartHubIfConfigured,
  registerIpcHandlers,
  shutdownDesktopServices,
} from './ipc.js'
import { configureAutoUpdater } from './updater.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? null

let mainWindow: BrowserWindow | null = null

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const indexHtml = path.resolve(__dirname, '..', 'dist', 'index.html')
    await mainWindow.loadFile(indexHtml)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  registerIpcHandlers()

  // If the user previously chose Hub mode, restart the hub on launch.
  // Failures here should not prevent the window from opening — surface
  // them via the renderer instead.
  try {
    await autoStartHubIfConfigured()
  } catch (err) {
    console.error('[main] Auto-start hub failed:', err)
  }

  await createWindow()

  // Check for updates after the window is up so any user prompts have
  // a parent window to attach to.
  configureAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', async () => {
  await shutdownDesktopServices()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  // Allow services a chance to clean up. quit() is idempotent.
  event.preventDefault()
  try {
    await shutdownDesktopServices()
  } catch (err) {
    console.error('[main] Shutdown error:', err)
  } finally {
    app.exit(0)
  }
})
