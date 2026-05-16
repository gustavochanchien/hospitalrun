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

vi.mock('@/features/billing/InvoiceListPage', () => ({
  InvoiceListPage: () => <div data-testid="invoice-list" />,
}))

vi.mock('@/features/billing/InvoiceDetailPage', () => ({
  InvoiceDetailPage: ({ invoiceId }: { invoiceId: string }) => (
    <div data-testid="invoice-detail">{invoiceId}</div>
  ),
}))

vi.mock('@/lib/db', () => ({
  db: { invoices: { get: vi.fn().mockResolvedValue(undefined) } },
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => {
    try { return fn() } catch { return undefined }
  },
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

function BillingListRoute() {
  return (
    <FeatureGate
      feature="billing"
      fallback={<p>Billing is not enabled</p>}
    >
      <div data-testid="billing-content">Billing content</div>
    </FeatureGate>
  )
}

describe('BillingListRoute — FeatureGate', () => {
  it('shows fallback when billing feature is disabled', () => {
    mockFeatureEnabled.mockReturnValue(false)
    render(<BillingListRoute />)
    expect(screen.getByText('Billing is not enabled')).toBeInTheDocument()
    expect(screen.queryByTestId('billing-content')).not.toBeInTheDocument()
  })

  it('renders billing content when feature is enabled', () => {
    mockFeatureEnabled.mockReturnValue(true)
    render(<BillingListRoute />)
    expect(screen.getByTestId('billing-content')).toBeInTheDocument()
    expect(screen.queryByText('Billing is not enabled')).not.toBeInTheDocument()
  })
})
