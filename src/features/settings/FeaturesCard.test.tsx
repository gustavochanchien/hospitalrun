import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { useAuthStore } from '@/features/auth/auth.store'
import { FeaturesCard } from './FeaturesCard'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const orgId = 'org-features-card'
const userId = 'user-features-card'

beforeEach(async () => {
  await db.transaction('rw', db.orgFeatures, db.userFeatures, db.syncQueue, async () => {
    await db.orgFeatures.clear()
    await db.userFeatures.clear()
    await db.syncQueue.clear()
  })
  useAuthStore.setState({
    user: { id: userId, email: 'a@b.com' } as never,
    session: null,
    orgId,
    role: 'admin',
    isLoading: false,
  })
})

describe('FeaturesCard', () => {
  it('renders a switch for each feature, all off by default', async () => {
    render(<FeaturesCard />)
    await waitFor(() => {
      expect(screen.getByLabelText(/PDF export/i)).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByLabelText(/Billing/i)).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByLabelText(/Inventory/i)).toHaveAttribute('aria-checked', 'false')
    })
  })

  it('toggling a feature writes an org_features row and a sync queue entry', async () => {
    render(<FeaturesCard />)
    const billingSwitch = await screen.findByLabelText(/Billing/i)
    await userEvent.click(billingSwitch)

    await waitFor(async () => {
      const rows = await db.orgFeatures.where('orgId').equals(orgId).toArray()
      expect(rows).toHaveLength(1)
      expect(rows[0]!.feature).toBe('billing')
      expect(rows[0]!.enabled).toBe(true)
    })
    const queue = await db.syncQueue.toArray()
    expect(queue.some((q) => q.tableName === 'orgFeatures')).toBe(true)
  })

  it('disables switches for non-admin users', async () => {
    useAuthStore.setState({ role: 'doctor' })
    render(<FeaturesCard />)
    const billingSwitch = await screen.findByLabelText(/Billing/i)
    expect(billingSwitch).toBeDisabled()
  })
})
