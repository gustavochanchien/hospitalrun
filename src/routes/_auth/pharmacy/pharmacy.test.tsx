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

vi.mock('@/features/pharmacy/PharmacyPage', () => ({
  PharmacyPage: () => <div data-testid="pharmacy-content" />,
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

function PharmacyRoute() {
  return (
    <FeatureGate
      feature="pharmacy"
      fallback={<p>Pharmacy is disabled</p>}
    >
      <div data-testid="pharmacy-content">Pharmacy content</div>
    </FeatureGate>
  )
}

describe('PharmacyRoute — FeatureGate', () => {
  it('shows fallback when pharmacy feature is disabled', () => {
    mockFeatureEnabled.mockReturnValue(false)
    render(<PharmacyRoute />)
    expect(screen.getByText('Pharmacy is disabled')).toBeInTheDocument()
    expect(screen.queryByTestId('pharmacy-content')).not.toBeInTheDocument()
  })

  it('renders pharmacy content when feature is enabled', () => {
    mockFeatureEnabled.mockReturnValue(true)
    render(<PharmacyRoute />)
    expect(screen.getByTestId('pharmacy-content')).toBeInTheDocument()
    expect(screen.queryByText('Pharmacy is disabled')).not.toBeInTheDocument()
  })
})
