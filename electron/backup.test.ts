// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let userData: string

vi.mock('electron', () => ({
  app: { getPath: () => userData },
}))

import { readStatus, runBackup } from './backup'

let targetDir: string

beforeEach(async () => {
  userData = await fs.mkdtemp(path.join(os.tmpdir(), 'hr-userdata-'))
  targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hr-backup-target-'))
})

afterEach(async () => {
  await fs.rm(userData, { recursive: true, force: true })
  await fs.rm(targetDir, { recursive: true, force: true })
})

describe('backup runBackup', () => {
  it('creates a timestamped folder and copies present hub files', async () => {
    await fs.writeFile(path.join(userData, 'sync-log.sqlite'), 'fake sqlite payload')
    await fs.writeFile(path.join(userData, 'auth-cache.sqlite'), 'fake cache')
    await fs.writeFile(
      path.join(userData, 'hub-signing-key.json'),
      JSON.stringify({ kid: 'hub-test' }),
    )

    const result = await runBackup(targetDir)
    expect(result.filesCopied).toContain('sync-log.sqlite')
    expect(result.filesCopied).toContain('auth-cache.sqlite')
    expect(result.filesCopied).toContain('hub-signing-key.json')
    expect(result.bytesCopied).toBeGreaterThan(0)

    // The destination folder should exist
    const stat = await fs.stat(result.destination)
    expect(stat.isDirectory()).toBe(true)
    // And contain at least the sqlite file
    const files = await fs.readdir(result.destination)
    expect(files).toContain('sync-log.sqlite')
  })

  it('handles a fresh install where no hub files exist yet', async () => {
    const result = await runBackup(targetDir)
    expect(result.filesCopied).toEqual([])
    expect(result.bytesCopied).toBe(0)
  })

  it('updates status with the destination + finishedAt', async () => {
    await fs.writeFile(path.join(userData, 'sync-log.sqlite'), 'data')
    const before = await readStatus()
    expect(before.lastBackupAt).toBeNull()
    const result = await runBackup(targetDir)
    const after = await readStatus()
    expect(after.lastBackupAt).toBe(result.finishedAt)
    expect(after.lastDestination).toBe(result.destination)
  })
})
