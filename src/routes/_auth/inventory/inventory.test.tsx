import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => ({ component: (c: unknown) => c }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

vi.mock('@/features/inventory/InventoryListPage', () => ({
  InventoryListPage: () => <div data-testid="inventory-list" />,
}))

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => true,
}))

const mockFeatureEnabled = vi.fn(() => false)

vi.mock('@/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => mockFeatureEnabled(),
  useEnabledFeatures: () => [] as string[],
}))

import { FeatureGate } from '@/components/ui/feature-gate'

function InventoryListRoute() {
  return (
    <FeatureGate
      feature="inventory"
      fallback={<p>Inventory is not enabled</p>}
    >
      <div data-testid="inventory-content">Inventory content</div>
    </FeatureGate>
  )
}

describe('InventoryListRoute — FeatureGate', () => {
  it('shows fallback when inventory feature is disabled', () => {
    mockFeatureEnabled.mockReturnValue(false)
    render(<InventoryListRoute />)
    expect(screen.getByText('Inventory is not enabled')).toBeInTheDocument()
    expect(screen.queryByTestId('inventory-content')).not.toBeInTheDocument()
  })

  it('renders inventory content when feature is enabled', () => {
    mockFeatureEnabled.mockReturnValue(true)
    render(<InventoryListRoute />)
    expect(screen.getByTestId('inventory-content')).toBeInTheDocument()
    expect(screen.queryByText('Inventory is not enabled')).not.toBeInTheDocument()
  })
})
