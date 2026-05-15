import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CloudConnectForm } from './CloudConnectForm'
import type { DesktopIPC } from '@/lib/desktop/env'

const saveBackendConfig = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  saveBackendConfig: (...args: unknown[]) => saveBackendConfig(...args),
}))

const fetchSpy = vi.fn()
const originalFetch = globalThis.fetch
const assignSpy = vi.fn()
const originalAssign = window.location.assign

beforeEach(() => {
  saveBackendConfig.mockReset()
  fetchSpy.mockReset()
  assignSpy.mockReset()
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: assignSpy },
  })
})

afterEach(() => {
  delete window.hospitalrunIPC
  globalThis.fetch = originalFetch
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: originalAssign },
  })
})

const validUrl = 'https://test-project.supabase.co'
const validKey = 'sb_publishable_long_enough_test_anon_key_value'

function installFakeIPC(overrides: Partial<DesktopIPC> = {}): DesktopIPC {
  const fake: DesktopIPC = {
    getRunMode: async () => null,
    setRunMode: async () => {},
    setBackendConfig: vi.fn(async () => {}),
    startHub: async () => ({ url: 'http://1.2.3.4:5174', hostname: '1.2.3.4', port: 5174 }),
    stopHub: async () => {},
    getHubInfo: async () => null,
    openExternal: async () => {},
    getAppVersion: async () => '0.0.0',
    runBackup: async () => null,
    getBackupStatus: async () => ({ lastBackupAt: null, lastDestination: null, lastError: null }),
    restoreBackup: async () => null,
    onUpdateDownloaded: () => () => {},
    installUpdate: async () => {},
    ...overrides,
  }
  window.hospitalrunIPC = fake
  return fake
}

describe('CloudConnectForm', () => {
  it('shows validation errors on empty submit', async () => {
    render(<CloudConnectForm />)
    await userEvent.click(screen.getByRole('button', { name: /^Connect$/i }))
    expect(await screen.findByText(/Server URL is required/i)).toBeInTheDocument()
    expect(saveBackendConfig).not.toHaveBeenCalled()
  })

  it('rejects malformed URL', async () => {
    render(<CloudConnectForm />)
    await userEvent.type(screen.getByLabelText(/Server URL/i), 'not a url')
    await userEvent.type(screen.getByLabelText(/Anon key/i), validKey)
    await userEvent.click(screen.getByRole('button', { name: /^Connect$/i }))
    expect(await screen.findByText(/valid http\(s\) URL/i)).toBeInTheDocument()
    expect(saveBackendConfig).not.toHaveBeenCalled()
  })

  it('saves with normalized URL and reloads when no onSaved callback', async () => {
    render(<CloudConnectForm />)
    // Trailing slash should be stripped by normalizeUrl
    await userEvent.type(screen.getByLabelText(/Server URL/i), validUrl + '/')
    await userEvent.type(screen.getByLabelText(/Anon key/i), validKey)
    await userEvent.click(screen.getByRole('button', { name: /^Connect$/i }))
    await waitFor(() => expect(saveBackendConfig).toHaveBeenCalled())
    expect(saveBackendConfig).toHaveBeenCalledWith({
      url: validUrl,
      anonKey: validKey,
    })
    expect(assignSpy).toHaveBeenCalledWith('/')
  })

  it('calls onSaved instead of reloading when callback provided', async () => {
    const onSaved = vi.fn()
    render(<CloudConnectForm onSaved={onSaved} />)
    await userEvent.type(screen.getByLabelText(/Server URL/i), validUrl)
    await userEvent.type(screen.getByLabelText(/Anon key/i), validKey)
    await userEvent.click(screen.getByRole('button', { name: /^Connect$/i }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onSaved).toHaveBeenCalledWith({ url: validUrl, anonKey: validKey })
    expect(assignSpy).not.toHaveBeenCalled()
  })

  it('mirrors config to Electron via IPC.setBackendConfig when desktop', async () => {
    const ipc = installFakeIPC()
    render(<CloudConnectForm />)
    await userEvent.type(screen.getByLabelText(/Server URL/i), validUrl)
    await userEvent.type(screen.getByLabelText(/Anon key/i), validKey)
    await userEvent.click(screen.getByRole('button', { name: /^Connect$/i }))
    await waitFor(() => expect(ipc.setBackendConfig).toHaveBeenCalled())
    expect(ipc.setBackendConfig).toHaveBeenCalledWith({
      url: validUrl,
      anonKey: validKey,
    })
  })

  it('Test connection button probes /auth/v1/health', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }))
    render(<CloudConnectForm />)
    await userEvent.type(screen.getByLabelText(/Server URL/i), validUrl)
    await userEvent.type(screen.getByLabelText(/Anon key/i), validKey)
    await userEvent.click(screen.getByRole('button', { name: /Test connection/i }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [calledUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe(`${validUrl}/auth/v1/health`)
    expect((init.headers as Record<string, string>).apikey).toBe(validKey)
    expect(await screen.findByText(/Server reachable/i)).toBeInTheDocument()
  })

  it('shows server-error message when probe returns non-2xx', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }))
    render(<CloudConnectForm />)
    await userEvent.type(screen.getByLabelText(/Server URL/i), validUrl)
    await userEvent.type(screen.getByLabelText(/Anon key/i), validKey)
    await userEvent.click(screen.getByRole('button', { name: /Test connection/i }))
    expect(await screen.findByText(/responded with 500/i)).toBeInTheDocument()
  })

  describe('Find hub on network', () => {
    it('does not show the Find Hub block by default', () => {
      render(<CloudConnectForm />)
      expect(
        screen.queryByRole('button', { name: /find hub on this network/i }),
      ).not.toBeInTheDocument()
    })

    it('shows the Find Hub button when showFindHub is set', () => {
      render(<CloudConnectForm showFindHub />)
      expect(
        screen.getByRole('button', { name: /find hub on this network/i }),
      ).toBeInTheDocument()
    })

    it('probes /_discover and navigates to the discovered URL on success', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            app: 'HospitalRun',
            version: '1.0.0',
            url: 'http://192.168.1.50:5174',
            hostname: 'hospitalrun.local',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      render(<CloudConnectForm showFindHub />)
      await userEvent.click(
        screen.getByRole('button', { name: /find hub on this network/i }),
      )
      const [calledUrl] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(calledUrl).toBe('http://hospitalrun.local:5174/_discover')
      const openHub = await screen.findByRole('button', { name: /open hub/i })
      await userEvent.click(openHub)
      expect(assignSpy).toHaveBeenCalledWith('http://192.168.1.50:5174')
    })

    it('shows a not-found message when /_discover fails', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network'))
      render(<CloudConnectForm showFindHub />)
      await userEvent.click(
        screen.getByRole('button', { name: /find hub on this network/i }),
      )
      expect(
        await screen.findByText(/no hospitalrun hub found/i),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /try again/i }),
      ).toBeInTheDocument()
    })

    it('treats a non-HospitalRun /_discover response as not-found', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ app: 'OtherApp', url: 'http://x' }),
          { status: 200 },
        ),
      )
      render(<CloudConnectForm showFindHub />)
      await userEvent.click(
        screen.getByRole('button', { name: /find hub on this network/i }),
      )
      expect(
        await screen.findByText(/no hospitalrun hub found/i),
      ).toBeInTheDocument()
      expect(assignSpy).not.toHaveBeenCalled()
    })
  })
})
