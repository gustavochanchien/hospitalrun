import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HubSetupFlow } from './HubSetupFlow'
import type { DesktopIPC, HubInfo } from '@/lib/desktop/env'

const saveBackendConfig = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  saveBackendConfig: (...args: unknown[]) => saveBackendConfig(...args),
}))

const assignSpy = vi.fn()
const originalAssign = window.location.assign
beforeEach(() => {
  saveBackendConfig.mockReset()
  assignSpy.mockReset()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      assign: assignSpy,
    },
  })
})

afterEach(() => {
  delete window.hospitalrunIPC
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: originalAssign },
  })
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

async function fillAndSubmitCloudForm() {
  const url = await screen.findByLabelText(/Server URL/i)
  const key = await screen.findByLabelText(/Anon key/i)
  await userEvent.type(url, 'https://test-project.supabase.co')
  await userEvent.type(key, 'sb_publishable_test_token_with_enough_length')
  // The submit button in HubSetupFlow's connect step is labeled "Continue"
  const button = screen.getByRole('button', { name: /Continue/i })
  await userEvent.click(button)
}

describe('HubSetupFlow', () => {
  it('renders the connect step on initial mount', () => {
    installFakeIPC()
    render(<HubSetupFlow onBack={vi.fn()} />)
    expect(screen.getByLabelText(/Server URL/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument()
  })

  it('calls Back when the connect-step Back button is clicked', async () => {
    installFakeIPC()
    const onBack = vi.fn()
    render(<HubSetupFlow onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: /Back/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('on successful save, persists hub run mode and starts the hub', async () => {
    const ipc = installFakeIPC()
    render(<HubSetupFlow onBack={vi.fn()} />)
    await fillAndSubmitCloudForm()

    await waitFor(() => expect(ipc.setRunMode).toHaveBeenCalledWith('hub'))
    expect(ipc.startHub).toHaveBeenCalled()
    expect(saveBackendConfig).toHaveBeenCalledWith({
      url: 'https://test-project.supabase.co',
      anonKey: 'sb_publishable_test_token_with_enough_length',
    })
  })

  it('shows the LAN URL in the ready panel after startHub resolves', async () => {
    installFakeIPC()
    render(<HubSetupFlow onBack={vi.fn()} />)
    await fillAndSubmitCloudForm()

    expect(await screen.findByText(/192\.168\.1\.42:5174/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open HospitalRun/i })).toBeInTheDocument()
  })

  it('shows error panel when startHub rejects, then allows retry', async () => {
    installFakeIPC({
      startHub: vi.fn(async () => {
        throw new Error('mdns busted')
      }) as unknown as () => Promise<HubInfo>,
    })
    render(<HubSetupFlow onBack={vi.fn()} />)
    await fillAndSubmitCloudForm()

    expect(await screen.findByText(/mdns busted/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Try again/i }))

    // Back to the connect step
    expect(await screen.findByLabelText(/Server URL/i)).toBeInTheDocument()
  })
})
