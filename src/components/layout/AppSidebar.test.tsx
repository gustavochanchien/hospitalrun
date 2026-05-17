import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock TanStack Router hooks used by AppSidebar
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useMatchRoute: () => () => false,
  useNavigate: () => vi.fn(),
}))

vi.mock('@/features/auth/auth.store', () => ({
  useAuthStore: () => ({ user: null, role: null, signOut: vi.fn() }),
}))

vi.mock('@/lib/demo/seed', () => ({
  isDemoMode: () => false,
  setDemoRole: vi.fn(),
  DEMO_ROLES: ['admin', 'doctor', 'nurse', 'user'] as const,
}))

const mockEnabledFeatures = vi.fn(() => [] as string[])

vi.mock('@/hooks/useFeatureEnabled', () => ({
  useEnabledFeatures: () => mockEnabledFeatures(),
}))

// Minimal sidebar shim so Radix sidebar context doesn't throw
vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  SidebarGroupContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children?: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children }: { children?: React.ReactNode; asChild?: boolean; isActive?: boolean }) => (
    <div>{children}</div>
  ),
  SidebarMenuItem: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  SidebarHeader: ({ children }: { children?: React.ReactNode }) => <header>{children}</header>,
  SidebarFooter: ({ children }: { children?: React.ReactNode }) => <footer>{children}</footer>,
  SidebarTrigger: () => null,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

import { AppSidebar } from './AppSidebar'

describe('AppSidebar — billing entry', () => {
  beforeEach(() => {
    mockEnabledFeatures.mockReset()
    mockEnabledFeatures.mockReturnValue([])
  })

  it('hides the Billing nav item when billing feature is off', () => {
    render(<AppSidebar />)
    expect(screen.queryByText('Billing')).not.toBeInTheDocument()
  })

  it('shows the Billing nav item when billing feature is enabled', () => {
    mockEnabledFeatures.mockReturnValue(['billing'])
    render(<AppSidebar />)
    expect(screen.getByText('Billing')).toBeInTheDocument()
  })
})

describe('AppSidebar — inventory entry', () => {
  beforeEach(() => {
    mockEnabledFeatures.mockReset()
    mockEnabledFeatures.mockReturnValue([])
  })

  it('hides the Inventory nav item when inventory feature is off', () => {
    render(<AppSidebar />)
    expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
  })

  it('shows the Inventory nav item when inventory feature is enabled', () => {
    mockEnabledFeatures.mockReturnValue(['inventory'])
    render(<AppSidebar />)
    expect(screen.getByText('Inventory')).toBeInTheDocument()
  })
})
