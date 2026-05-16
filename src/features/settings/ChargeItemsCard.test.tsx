import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { useAuthStore } from '@/features/auth/auth.store'
import { ChargeItemsCard } from './ChargeItemsCard'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const orgId = 'org-charge-items'
const userId = 'user-charge-items'

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.chargeItems,
    db.orgFeatures,
    db.userFeatures,
    db.syncQueue,
    async () => {
      await db.chargeItems.clear()
      await db.orgFeatures.clear()
      await db.userFeatures.clear()
      await db.syncQueue.clear()
    },
  )
  // Enable the billing feature for the org so the FeatureGate lets the card through.
  await db.orgFeatures.put({
    id: crypto.randomUUID(),
    orgId,
    feature: 'billing',
    enabled: true,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _synced: true,
    _deleted: false,
  })
  useAuthStore.setState({
    user: { id: userId, email: 'a@b.com' } as never,
    session: null,
    orgId,
    role: 'admin',
    isLoading: false,
  })
})

describe('ChargeItemsCard', () => {
  it('hides when the billing feature is disabled', async () => {
    await db.orgFeatures.clear()
    render(<ChargeItemsCard />)
    expect(screen.queryByText(/Charge items catalog/i)).not.toBeInTheDocument()
  })

  it('shows the card and empty state when the feature is on', async () => {
    render(<ChargeItemsCard />)
    expect(await screen.findByText(/Charge items catalog/i)).toBeInTheDocument()
    expect(await screen.findByText(/No charge items yet/i)).toBeInTheDocument()
  })

  it('creates a charge item via the add dialog', async () => {
    render(<ChargeItemsCard />)

    await userEvent.click(await screen.findByRole('button', { name: /Add charge item/i }))

    await userEvent.type(screen.getByLabelText(/^Code$/i), 'CONSULT-1')
    await userEvent.type(screen.getByLabelText(/^Name$/i), 'Consultation')
    const unitAmount = screen.getByLabelText(/Unit price/i) as HTMLInputElement
    await userEvent.clear(unitAmount)
    await userEvent.type(unitAmount, '50')

    await userEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(async () => {
      const rows = await db.chargeItems.toArray()
      expect(rows).toHaveLength(1)
      expect(rows[0]!.code).toBe('CONSULT-1')
      expect(rows[0]!.name).toBe('Consultation')
      expect(rows[0]!.unitAmount).toBe(50)
    })

    const queue = await db.syncQueue.toArray()
    expect(queue.some((q) => q.tableName === 'chargeItems')).toBe(true)
  })
})
