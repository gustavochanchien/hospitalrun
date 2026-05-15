import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HubSetupFlow } from './HubSetupFlow'
import type { DesktopIPC, HubInfo } from '@/lib/desktop/env'

vi.mock('@/lib/supabase/client', () => ({
  saveBackendConfig: vi.fn(),
  isHubLocalMode: vi.fn(() => false),
}))

const signIn = vi.fn()
vi.mock('@/features/auth/auth.store', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ signIn: (...args: unknown[]) => signIn(...args) }),
}))

const assignSpy = vi.fn()
const originalAssign = window.location.assign
beforeEach(() => {
  signIn.mockReset()
  signIn.mockResolvedValue({ error: null })
  assignSpy.mockReset()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: assignSpy },
  })
  // Default fetch mock: POST /auth/local/user succeeds
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ userId: 'u-1', email: 'admin@test.com', orgId: 'org-1', role: 'admin' }),
  }))
})

afterEach(() => {
  delete window.hospitalrunIPC
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: originalAssign },
  })
  vi.unstubAllGlobals()
})

function installFakeIPC(overrides: Partial<DesktopIPC> = {}): DesktopIPC {
  const fake: DesktopIPC = {
    getRunMode: async () => null,
    setRunMode: vi.fn(async () => {}),
    setBackendConfig: vi.fn(async () => {}),
    startHub: vi.fn(async () => ({
      url: 'http://192.168.1.42:5174',
      hostname: '192.168.1.42',
      port: 5174,
    })),
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

describe('HubSetupFlow', () => {
  it('renders the start step with a "Start hub" button on initial mount', () => {
    installFakeIPC()
    render(<HubSetupFlow onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Start hub/i })).toBeInTheDocument()
  })

  it('calls Back when the back button is clicked', async () => {
    installFakeIPC()
    const onBack = vi.fn()
    render(<HubSetupFlow onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: /Back/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('calls setRunMode(hub) and startHub when "Start hub" is clicked', async () => {
    const ipc = installFakeIPC()
    render(<HubSetupFlow onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Start hub/i }))
    await waitFor(() => expect(ipc.setRunMode).toHaveBeenCalledWith('hub'))
    expect(ipc.startHub).toHaveBeenCalled()
  })

  it('shows the first-user form after startHub succeeds', async () => {
    installFakeIPC()
    render(<HubSetupFlow onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Start hub/i }))
    expect(await screen.findByRole('button', { name: /Create admin account/i })).toBeInTheDocument()
  })

  it('shows error panel when startHub rejects, then allows retry', async () => {
    installFakeIPC({
      startHub: vi.fn(async () => {
        throw new Error('mdns busted')
      }) as unknown as () => Promise<HubInfo>,
    })
    render(<HubSetupFlow onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Start hub/i }))

    expect(await screen.findByText(/mdns busted/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Try again/i }))

    // Back to the start step
    expect(await screen.findByRole('button', { name: /Start hub/i })).toBeInTheDocument()
  })

  it('advances through first-user form to cloud-prompt step', async () => {
    installFakeIPC()
    render(<HubSetupFlow onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Start hub/i }))

    // Fill first-user form
    await userEvent.type(await screen.findByLabelText(/Full name/i), 'Admin User')
    await userEvent.type(screen.getByLabelText(/^Email$/i), 'admin@test.com')
    await userEvent.type(screen.getByLabelText(/^Password$/i), 'password123')
    await userEvent.type(screen.getByLabelText(/Confirm password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /Create admin account/i }))

    // Should advance to cloud-prompt (skip button visible)
    expect(await screen.findByRole('button', { name: /Skip for now/i })).toBeInTheDocument()
  })
})
