import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUsePermission = vi.fn()
vi.mock('@/hooks/usePermission', () => ({
  usePermission: (perm: string) => mockUsePermission(perm),
}))

vi.mock('./use-access-logs', () => ({
  PAGE_SIZE: 50,
  DEFAULT_FILTERS: {
    search: '',
    userId: null,
    action: null,
    resourceType: null,
    from: null,
    to: null,
  },
  useAccessLogs: () => ({ rows: [], total: 0, isLoading: false, error: null }),
}))

import { AuditLogPage } from './AuditLogPage'

describe('AuditLogPage', () => {
  it('renders the unauthorized fallback when the user lacks read:audit_log', () => {
    mockUsePermission.mockImplementation((perm) =>
      perm === 'read:audit_log' ? false : true,
    )
    render(<AuditLogPage />)
    expect(screen.getByText('Admins only')).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText(/search user, patient/i),
    ).not.toBeInTheDocument()
  })

  it('renders the viewer when the user has read:audit_log', () => {
    mockUsePermission.mockImplementation(() => true)
    render(<AuditLogPage />)
    expect(
      screen.getByPlaceholderText(/search user, patient/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/no audit events/i)).toBeInTheDocument()
  })
})
