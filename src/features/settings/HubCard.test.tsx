import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HubCard } from './HubCard'
import type { DesktopIPC, DesktopMode, RestoreResult } from '@/lib/desktop/env'

const sampleHubInfo = { url: 'http://192.168.1.10:5174', hostname: '192.168.1.10', port: 5174 }

beforeEach(() => {
  delete window.hospitalrunIPC
})

afterEach(() => {
  delete window.hospitalrunIPC
})

function installFakeIPC(overrides: Partial<DesktopIPC> = {}): DesktopIPC {
  const fake: DesktopIPC = {
    getRunMode: vi.fn(async (): Promise<DesktopMode | null> => 'hub'),
    setRunMode: vi.fn(async () => {}),
    setBackendConfig: vi.fn(async () => {}),
    startHub: vi.fn(async () => sampleHubInfo),
    stopHub: vi.fn(async () => {}),
    getHubInfo: vi.fn(async () => sampleHubInfo),
    openExternal: vi.fn(async () => {}),
    getAppVersion: vi.fn(async () => '0.0.0'),
    runBackup: vi.fn(async () => ({
      destination: '/tmp/backup-1',
      filesCopied: ['sync-log.sqlite'],
      bytesCopied: 4096,
      startedAt: Date.now(),
      finishedAt: Date.now(),
    })),
    getBackupStatus: vi.fn(async () => ({
      lastBackupAt: null,
      lastDestination: null,
      lastError: null,
    })),
    restoreBackup: vi.fn(async () => ({ filesRestored: ['sync-log.sqlite'], bytesCopied: 4096 })),
    onUpdateDownloaded: () => () => {},
    installUpdate: async () => {},
    ...overrides,
  }
  window.hospitalrunIPC = fake
  return fake
}

describe('HubCard', () => {
  it('renders nothing in a plain web build', () => {
    const { container } = render(<HubCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows hub mode + LAN URL when running in Hub mode', async () => {
    installFakeIPC()
    render(<HubCard />)
    expect(await screen.findByText(/Hub/)).toBeInTheDocument()
    expect(await screen.findByText(/192\.168\.1\.10:5174/)).toBeInTheDocument()
  })

  it('shows Solo when in Solo mode', async () => {
    installFakeIPC({
      getRunMode: vi.fn(async (): Promise<DesktopMode | null> => 'solo'),
      getHubInfo: vi.fn(async () => null),
    })
    render(<HubCard />)
    expect(await screen.findByText(/Solo/)).toBeInTheDocument()
    // No LAN URL
    expect(screen.queryByText(/LAN URL/i)).toBeNull()
  })

  it('runs a backup when the button is clicked and refreshes the status', async () => {
    let statusCalls = 0
    const ipc = installFakeIPC({
      getBackupStatus: vi.fn(async () => {
        statusCalls++
        // First call: never; subsequent: 1s ago
        return statusCalls === 1
          ? { lastBackupAt: null, lastDestination: null, lastError: null }
          : { lastBackupAt: Date.now() - 1000, lastDestination: '/tmp/backup-1', lastError: null }
      }),
    })

    render(<HubCard />)
    const button = await screen.findByRole('button', { name: /Backup hub data now/i })
    await userEvent.click(button)
    await waitFor(() => expect(ipc.runBackup).toHaveBeenCalled())
    // Status was queried once initially + once after backup
    expect(statusCalls).toBeGreaterThanOrEqual(2)
  })

  it('invokes restoreBackup when the Restore button is clicked', async () => {
    const ipc = installFakeIPC()
    render(<HubCard />)
    const button = await screen.findByRole('button', { name: /Restore from backup/i })
    await userEvent.click(button)
    await waitFor(() => expect(ipc.restoreBackup).toHaveBeenCalledTimes(1))
  })

  it('disables the Backup button while a restore is in progress', async () => {
    const deferred: {
      promise: Promise<RestoreResult | null>
      resolve: (value: RestoreResult | null) => void
    } = (() => {
      let resolve!: (value: RestoreResult | null) => void
      const promise = new Promise<RestoreResult | null>((r) => {
        resolve = r
      })
      return { promise, resolve }
    })()
    installFakeIPC({
      restoreBackup: vi.fn(async () => deferred.promise),
    })
    render(<HubCard />)
    const restoreBtn = await screen.findByRole('button', { name: /Restore from backup/i })
    await userEvent.click(restoreBtn)
    const backupBtn = screen.getByRole('button', { name: /Backup hub data now/i })
    expect(backupBtn).toBeDisabled()
    expect(screen.getByRole('button', { name: /Restoring…/i })).toBeDisabled()
    deferred.resolve({ filesRestored: [], bytesCopied: 0 })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Restore from backup/i })).not.toBeDisabled(),
    )
  })
})
