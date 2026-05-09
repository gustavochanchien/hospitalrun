import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

/**
 * Manual backup of the hub's persistent state to a user-chosen folder.
 *
 * What gets backed up:
 *  - `sync-log.sqlite` — the LAN write log; lets us replay every write
 *    that flowed through the hub.
 *  - `auth-cache.sqlite` — cached profiles for offline signin.
 *  - `hub-signing-key.json` — the hub's RSA keypair (so a restored
 *    backup keeps issuing tokens that the relay accepts).
 *  - `desktop-config.json` — runMode + cached backend config.
 *
 * Dexie data on each device is not backed up here — every device has
 * its own copy via Dexie + service worker, and cloud Supabase remains
 * the canonical store. The hub backup is recovery insurance for the
 * hub itself.
 */

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

const STATUS_FILE = 'backup-status.json'

const HUB_FILES = [
  'sync-log.sqlite',
  'sync-log.sqlite-wal',
  'sync-log.sqlite-shm',
  'auth-cache.sqlite',
  'auth-cache.sqlite-wal',
  'auth-cache.sqlite-shm',
  'hub-signing-key.json',
  'desktop-config.json',
]

function statusPath(): string {
  return path.join(app.getPath('userData'), STATUS_FILE)
}

function userDataDir(): string {
  return app.getPath('userData')
}

async function safeCopy(src: string, dest: string): Promise<{ copied: boolean; size: number }> {
  try {
    const stat = await fs.stat(src)
    if (!stat.isFile()) return { copied: false, size: 0 }
    await fs.copyFile(src, dest)
    return { copied: true, size: stat.size }
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'ENOENT') return { copied: false, size: 0 }
    throw err
  }
}

function formatTimestamp(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, '-')
}

export async function runBackup(targetParent: string): Promise<BackupResult> {
  const startedAt = Date.now()
  const folderName = `hospitalrun-backup-${formatTimestamp(new Date(startedAt))}`
  const destination = path.join(targetParent, folderName)
  await fs.mkdir(destination, { recursive: true })

  const dataDir = userDataDir()
  const filesCopied: string[] = []
  let bytesCopied = 0
  for (const name of HUB_FILES) {
    const result = await safeCopy(path.join(dataDir, name), path.join(destination, name))
    if (result.copied) {
      filesCopied.push(name)
      bytesCopied += result.size
    }
  }

  const finishedAt = Date.now()
  await writeStatus({
    lastBackupAt: finishedAt,
    lastDestination: destination,
    lastError: null,
  })
  return { destination, filesCopied, bytesCopied, startedAt, finishedAt }
}

/**
 * Restore hub state from a previously saved backup folder.
 * The caller is responsible for stopping hub services (relay, auth cache,
 * log store) before calling this and restarting them after.
 */
export async function restoreFromBackup(backupFolderPath: string): Promise<RestoreResult> {
  const dataDir = userDataDir()
  const filesRestored: string[] = []
  let bytesCopied = 0
  for (const name of HUB_FILES) {
    const src = path.join(backupFolderPath, name)
    const result = await safeCopy(src, path.join(dataDir, name))
    if (result.copied) {
      filesRestored.push(name)
      bytesCopied += result.size
    }
  }
  return { filesRestored, bytesCopied }
}

export async function readStatus(): Promise<BackupStatus> {
  try {
    const raw = await fs.readFile(statusPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<BackupStatus>
    return {
      lastBackupAt: typeof parsed.lastBackupAt === 'number' ? parsed.lastBackupAt : null,
      lastDestination:
        typeof parsed.lastDestination === 'string' ? parsed.lastDestination : null,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    }
  } catch {
    return { lastBackupAt: null, lastDestination: null, lastError: null }
  }
}

async function writeStatus(s: BackupStatus): Promise<void> {
  await fs.mkdir(path.dirname(statusPath()), { recursive: true })
  await fs.writeFile(statusPath(), JSON.stringify(s, null, 2), 'utf8')
}
