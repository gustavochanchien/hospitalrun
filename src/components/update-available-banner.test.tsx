import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateAvailableBanner } from './update-available-banner'
import type { DesktopIPC, UpdateDownloadedPayload } from '@/lib/desktop/env'

type UpdateListener = (info: UpdateDownloadedPayload) => void

function installMockIPC(): {
  emit: UpdateListener
  installUpdate: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
} {
  let listener: UpdateListener | null = null
  const unsubscribe = vi.fn(() => {
    listener = null
  })
  const installUpdate = vi.fn(async () => {})
  const ipc: Partial<DesktopIPC> = {
    onUpdateDownloaded: (cb: UpdateListener) => {
      listener = cb
      return unsubscribe
    },
    installUpdate,
  }
  ;(window as unknown as { hospitalrunIPC?: Partial<DesktopIPC> }).hospitalrunIPC = ipc
  return {
    emit: (info) => {
      if (!listener) throw new Error('No update listener registered')
      listener(info)
    },
    installUpdate,
    unsubscribe,
  }
}

describe('UpdateAvailableBanner', () => {
  beforeEach(() => {
    delete (window as unknown as { hospitalrunIPC?: unknown }).hospitalrunIPC
  })

  afterEach(() => {
    delete (window as unknown as { hospitalrunIPC?: unknown }).hospitalrunIPC
    vi.restoreAllMocks()
  })

  it('renders nothing in browser mode (no IPC bridge)', () => {
    const { container } = render(<UpdateAvailableBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing before an update-downloaded event fires', () => {
    installMockIPC()
    const { container } = render(<UpdateAvailableBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the banner with version when an update is downloaded', () => {
    const ipc = installMockIPC()
    render(<UpdateAvailableBanner />)
    act(() => ipc.emit({ version: '3.2.0' }))
    expect(screen.getByRole('status')).toHaveTextContent(/v3\.2\.0/)
    expect(screen.getByRole('button', { name: /restart to update/i })).toBeInTheDocument()
  })

  it('calls installUpdate when the user clicks Restart', async () => {
    const user = userEvent.setup()
    const ipc = installMockIPC()
    render(<UpdateAvailableBanner />)
    act(() => ipc.emit({ version: '3.2.0' }))
    await user.click(screen.getByRole('button', { name: /restart to update/i }))
    expect(ipc.installUpdate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /restarting/i })).toBeDisabled()
  })

  it('unsubscribes the listener on unmount', () => {
    const ipc = installMockIPC()
    const { unmount } = render(<UpdateAvailableBanner />)
    unmount()
    expect(ipc.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
