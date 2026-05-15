import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { discoverHub } from './hub-discovery'
import type { DesktopIPC } from './env'

const fetchSpy = vi.fn()
const originalFetch = globalThis.fetch

beforeEach(() => {
  fetchSpy.mockReset()
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
})

afterEach(() => {
  delete window.hospitalrunIPC
  globalThis.fetch = originalFetch
})

function installFakeIPC(getRunMode: () => Promise<'solo' | 'hub' | null>) {
  const fake: DesktopIPC = {
    getRunMode,
    setRunMode: async () => {},
    setBackendConfig: async () => {},
    startHub: async () => ({ url: '', hostname: '', port: 0 }),
    stopHub: async () => {},
    getHubInfo: async () => null,
    openExternal: async () => {},
    getAppVersion: async () => '0.0.0',
    runBackup: async () => null,
    getBackupStatus: async () => ({ lastBackupAt: null, lastDestination: null, lastError: null }),
    restoreBackup: async () => null,
    onUpdateDownloaded: () => () => {},
    installUpdate: async () => {},
  }
  window.hospitalrunIPC = fake
}

describe('discoverHub', () => {
  it('returns localhost:5174 when desktop is in hub mode', async () => {
    installFakeIPC(async () => 'hub')
    const info = await discoverHub()
    expect(info?.wsUrl).toBe('ws://localhost:5174/sync')
  })

  it('returns null when desktop is in solo mode', async () => {
    installFakeIPC(async () => 'solo')
    expect(await discoverHub()).toBeNull()
  })

  it('returns null when desktop has no run mode set', async () => {
    installFakeIPC(async () => null)
    expect(await discoverHub()).toBeNull()
  })

  it('probes /healthz in browser mode and returns ws URL on hub match', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, app: 'HospitalRun', version: '1.0.0' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const info = await discoverHub()
    expect(info?.wsUrl).toMatch(/\/sync$/)
    expect(fetchSpy).toHaveBeenCalledWith('/healthz', expect.any(Object))
  })

  it('returns null when /healthz responds for a non-hub app', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, app: 'OtherApp' }), { status: 200 }),
    )
    expect(await discoverHub()).toBeNull()
  })

  it('returns null when /healthz fails entirely', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'))
    expect(await discoverHub()).toBeNull()
  })
})
