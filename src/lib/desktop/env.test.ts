import { describe, it, expect, afterEach } from 'vitest'
import { isDesktop, getIPC, openExternal } from './env'
import type { DesktopIPC } from './env'

function installFakeIPC(overrides: Partial<DesktopIPC> = {}) {
  const fake: DesktopIPC = {
    getRunMode: async () => null,
    setRunMode: async () => {},
    setBackendConfig: async () => {},
    startHub: async () => ({ url: 'http://hospitalrun.local:5173', hostname: 'hospitalrun.local', port: 5173 }),
    stopHub: async () => {},
    getHubInfo: async () => null,
    openExternal: async () => {},
    getAppVersion: async () => '0.0.0',
    runBackup: async () => null,
    getBackupStatus: async () => ({ lastBackupAt: null, lastDestination: null, lastError: null }),
    restoreBackup: async () => null,
    ...overrides,
  }
  window.hospitalrunIPC = fake
  return fake
}

describe('desktop env', () => {
  afterEach(() => {
    delete window.hospitalrunIPC
  })

  it('isDesktop is false in plain browser', () => {
    expect(isDesktop()).toBe(false)
  })

  it('isDesktop is true when IPC bridge is present', () => {
    installFakeIPC()
    expect(isDesktop()).toBe(true)
  })

  it('getIPC throws outside desktop', () => {
    expect(() => getIPC()).toThrow(/Desktop IPC/)
  })

  it('openExternal routes through IPC when desktop', async () => {
    let calledWith: string | null = null
    installFakeIPC({
      openExternal: async (url) => {
        calledWith = url
      },
    })
    await openExternal('https://supabase.com')
    expect(calledWith).toBe('https://supabase.com')
  })
})
