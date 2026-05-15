import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SetupPage } from './SetupPage'
import type { DesktopIPC } from '@/lib/desktop/env'

vi.mock('@/lib/supabase/client', () => ({
  saveBackendConfig: vi.fn(),
}))

function installFakeIPC() {
  const fake: DesktopIPC = {
    getRunMode: async () => null,
    setRunMode: async () => {},
    setBackendConfig: async () => {},
    startHub: async () => ({ url: 'http://192.168.1.10:5174', hostname: '192.168.1.10', port: 5174 }),
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

describe('SetupPage', () => {
  afterEach(() => {
    delete window.hospitalrunIPC
  })

  it('renders the Cloud-only form directly in the web build', () => {
    render(<SetupPage />)
    expect(screen.getByText(/Connect to your server/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Server URL/i)).toBeInTheDocument()
    expect(screen.queryByText(/Run as a clinic hub/i)).toBeNull()
  })

  it('renders the Solo/Hub chooser first in the desktop build', () => {
    installFakeIPC()
    render(<SetupPage />)
    expect(screen.getByText(/Welcome to HospitalRun/i)).toBeInTheDocument()
    expect(screen.getByText(/Just this computer/i)).toBeInTheDocument()
    expect(screen.getByText(/Run as a clinic hub/i)).toBeInTheDocument()
  })
})
