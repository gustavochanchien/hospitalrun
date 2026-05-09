// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Per-test temp dir so tests don't collide with each other or with the
// real Electron userData path.
let tmpDir: string

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpDir,
  },
}))

import { getRunMode, setRunMode } from './run-mode-store'

const configFileName = 'desktop-config.json'

describe('run-mode-store', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hr-runmode-'))
  })

  it('returns null when no config file exists', async () => {
    expect(await getRunMode()).toBeNull()
  })

  it('round-trips solo', async () => {
    await setRunMode('solo')
    expect(await getRunMode()).toBe('solo')
  })

  it('round-trips hub', async () => {
    await setRunMode('hub')
    expect(await getRunMode()).toBe('hub')
  })

  it('overwrites a previously saved mode', async () => {
    await setRunMode('solo')
    await setRunMode('hub')
    expect(await getRunMode()).toBe('hub')
  })

  it('returns null on corrupt JSON', async () => {
    await fs.writeFile(path.join(tmpDir, configFileName), 'not json{{{', 'utf8')
    expect(await getRunMode()).toBeNull()
  })

  it('returns null on invalid mode value', async () => {
    await fs.writeFile(
      path.join(tmpDir, configFileName),
      JSON.stringify({ runMode: 'maybe' }),
      'utf8',
    )
    expect(await getRunMode()).toBeNull()
  })

  it('writes a parseable JSON file', async () => {
    await setRunMode('hub')
    const raw = await fs.readFile(path.join(tmpDir, configFileName), 'utf8')
    expect(JSON.parse(raw)).toEqual({ runMode: 'hub' })
  })
})
