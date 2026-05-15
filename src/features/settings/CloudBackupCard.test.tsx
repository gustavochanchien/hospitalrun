import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CloudBackupCard } from './CloudBackupCard'
import type { DesktopIPC, DesktopMode } from '@/lib/desktop/env'

const flushSyncQueue = vi.fn(async () => {})
const clearBackendConfig = vi.fn()
let mockLocalMode = false
let mockConfig: { url: string; anonKey: string } | null = null
let mockLastSyncAt: number | null = null

vi.mock('@/lib/supabase/client', () => ({
  isHubLocalMode: () => mockLocalMode,
  getBackendConfig: () => mockConfig,
  clearBackendConfig: () => clearBackendConfig(),
  saveBackendConfig: vi.fn(),
}))

vi.mock('@/lib/sync/sync', () => ({
  flushSyncQueue: () => flushSyncQueue(),
  getLastCloudSyncAt: () => mockLastSyncAt,
}))

const assignSpy = vi.fn()
const originalAssign = window.location.assign

function installFakeIPC(overrides: Partial<DesktopIPC> = {}): DesktopIPC {
  const fake: DesktopIPC = {
    getRunMode: vi.fn(async (): Promise<DesktopMode | null> => 'hub'),
    setRunMode: vi.fn(async () => {}),
    setBackendConfig: vi.fn(async () => {}),
    startHub: vi.fn(async () => ({ url: 'http://1.2.3.4:5174', hostname: '1.2.3.4', port: 5174 })),
    stopHub: vi.fn(async () => {}),
    getHubInfo: vi.fn(async () => null),
    openExternal: vi.fn(async () => {}),
    getAppVersion: vi.fn(async () => '0.0.0'),
    runBackup: vi.fn(async () => null),
    getBackupStatus: vi.fn(async () => ({ lastBackupAt: null, lastDestination: null, lastError: null })),
    restoreBackup: vi.fn(async () => null),
    onUpdateDownloaded: () => () => {},
    installUpdate: async () => {},
    ...overrides,
  }
  window.hospitalrunIPC = fake
  return fake
}

beforeEach(() => {
  flushSyncQueue.mockReset()
  flushSyncQueue.mockResolvedValue(undefined)
  clearBackendConfig.mockReset()
  assignSpy.mockReset()
  mockLocalMode = false
  mockConfig = null
  mockLastSyncAt = null
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: assignSpy },
  })
})

afterEach(() => {
  delete window.hospitalrunIPC
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: originalAssign },
  })
})

describe('CloudBackupCard', () => {
  it('renders nothing in a plain web build', () => {
    const { container } = render(<CloudBackupCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows Connect button when the hub is in local-only mode', () => {
    mockLocalMode = true
    installFakeIPC()
    render(<CloudBackupCard />)
    expect(
      screen.getByRole('button', { name: /Connect Supabase/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sync now/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Disconnect/i })).toBeNull()
  })

  it('shows the connected URL and Sync now / Disconnect buttons when configured', () => {
    mockLocalMode = false
    mockConfig = { url: 'https://example.supabase.co', anonKey: 'sb_publishable_x' }
    mockLastSyncAt = Date.now() - 60_000
    installFakeIPC()
    render(<CloudBackupCard />)
    expect(screen.getByText('https://example.supabase.co')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sync now/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument()
    expect(screen.getByText(/ago/i)).toBeInTheDocument()
  })

  it('shows "never" when no cloud sync has succeeded yet', () => {
    mockLocalMode = false
    mockConfig = { url: 'https://example.supabase.co', anonKey: 'sb_publishable_x' }
    mockLastSyncAt = null
    installFakeIPC()
    render(<CloudBackupCard />)
    expect(screen.getByText('never')).toBeInTheDocument()
  })

  it('calls flushSyncQueue and refreshes the timestamp when Sync now is clicked', async () => {
    mockLocalMode = false
    mockConfig = { url: 'https://example.supabase.co', anonKey: 'sb_publishable_x' }
    mockLastSyncAt = null
    installFakeIPC()
    flushSyncQueue.mockImplementation(async () => {
      mockLastSyncAt = Date.now()
    })
    render(<CloudBackupCard />)
    await userEvent.click(screen.getByRole('button', { name: /Sync now/i }))
    await waitFor(() => expect(flushSyncQueue).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/ago/i)).toBeInTheDocument()
  })

  it('opens disconnect confirmation, then clears config and reloads on confirm', async () => {
    mockLocalMode = false
    mockConfig = { url: 'https://example.supabase.co', anonKey: 'sb_publishable_x' }
    const ipc = installFakeIPC()
    render(<CloudBackupCard />)
    await userEvent.click(screen.getByRole('button', { name: /Disconnect/i }))
    // ConfirmDialog renders its confirm button with the label we passed.
    const confirmButtons = await screen.findAllByRole('button', { name: /Disconnect/i })
    // First match is the card's button (still present); confirm-dialog adds another.
    const confirm = confirmButtons[confirmButtons.length - 1]!
    await userEvent.click(confirm)
    await waitFor(() => expect(ipc.setBackendConfig).toHaveBeenCalledWith(null))
    expect(clearBackendConfig).toHaveBeenCalledTimes(1)
    expect(assignSpy).toHaveBeenCalledWith('/')
  })

  it('opens the connect dialog when Connect Supabase is clicked', async () => {
    mockLocalMode = true
    installFakeIPC()
    render(<CloudBackupCard />)
    await userEvent.click(screen.getByRole('button', { name: /Connect Supabase/i }))
    // CloudConnectForm renders inside the dialog — its Server URL input
    // is the easiest stable signal that the dialog is open.
    expect(await screen.findByLabelText(/Server URL/i)).toBeInTheDocument()
  })
})
